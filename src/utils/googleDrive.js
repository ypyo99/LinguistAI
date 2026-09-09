/**
 * googleDrive.js
 * 구글 드라이브 API 유틸리티 — 보관함 / 스토어 연동용
 *
 * 폴더 구조:
 *   내 드라이브 / LinguistAI / 보관함 / {pack_id}.json  ← 사용자 보관함
 *   내 드라이브 / LinguistAI / 스토어  / *.json         ← 관리자가 올린 프리미엄 데이터
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * 401 응답 시 토큰 만료로 처리할 수 있도록 에러를 throw합니다.
 */
async function checkResponse(res, errorPrefix = '드라이브 API 오류') {
  if (res.status === 401) {
    const err = new Error('TOKEN_EXPIRED');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) msg = body.error.message;
      // 403: 스코프 부족 — 신규 scope로 재로그인 필요
      if (
        res.status === 403 &&
        (msg.toLowerCase().includes('insufficient') ||
          msg.toLowerCase().includes('scope'))
      ) {
        const scopeErr = new Error('SCOPE_INSUFFICIENT');
        scopeErr.code = 'SCOPE_INSUFFICIENT';
        throw scopeErr;
      }
    } catch (inner) {
      if (inner.code === 'SCOPE_INSUFFICIENT') throw inner;
      // JSON 파싱 실패시는 무시
    }
    throw new Error(`${errorPrefix}: ${msg}`);
  }
  return res;
}

// ── 폴더 관리 ─────────────────────────────────────────────────────────────────

/**
 * 특정 부모 폴더 아래에서 이름으로 폴더를 검색합니다.
 * @returns {string|null} 폴더 ID, 없으면 null
 */
async function findFolder(accessToken, parentId, name) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;

  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  await checkResponse(res, '폴더 검색 실패');
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/**
 * 폴더를 생성합니다.
 * @returns {string} 새 폴더 ID
 */
async function createFolder(accessToken, parentId, name) {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentId ? { parents: [parentId] } : { parents: ['root'] }),
  };
  const res = await fetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });
  await checkResponse(res, '폴더 생성 실패');
  const data = await res.json();
  return data.id;
}

// ── 폴더 ID 캐시 (세션 내 중복 생성 방지) ────────────────────────────────────
// key: `${parentId ?? 'root'}::${name}` → folderId
const _folderCache = new Map();
// 진행 중인 요청을 공유해 동시 호출에서도 중복 생성 방지 (in-flight dedup)
const _folderInflight = new Map();

/**
 * 부모 폴더 아래에서 폴더를 찾거나, 없으면 생성합니다.
 * 캐시를 통해 이미 알고 있는 폴더는 API 없이 즉시 반환합니다.
 * @returns {string} 폴더 ID
 */
async function getOrCreateFolder(accessToken, parentId, name) {
  const cacheKey = `${parentId ?? 'root'}::${name}`;

  // 1. 캐시 히트
  if (_folderCache.has(cacheKey)) return _folderCache.get(cacheKey);

  // 2. 동시 요청 병합 (race condition 방지)
  if (_folderInflight.has(cacheKey)) return _folderInflight.get(cacheKey);

  const promise = (async () => {
    try {
      const existing = await findFolder(accessToken, parentId, name);
      const id = existing ?? await createFolder(accessToken, parentId, name);
      _folderCache.set(cacheKey, id);
      return id;
    } finally {
      _folderInflight.delete(cacheKey);
    }
  })();

  _folderInflight.set(cacheKey, promise);
  return promise;
}

/**
 * 보관함 폴더 ID를 반환합니다. (없으면 자동 생성)
 * 경로: 내 드라이브 → LinguistAI → 보관함
 * @returns {string} 보관함 폴더 ID
 */
export async function getLibraryFolderId(accessToken) {
  const linguistFolderId = await getOrCreateFolder(accessToken, null, 'LinguistAI');
  const libraryFolderId = await getOrCreateFolder(accessToken, linguistFolderId, '보관함');
  return libraryFolderId;
}

/**
 * 스토어 폴더 ID를 반환합니다. (폴더가 없으면 null 반환 — 읽기 전용이므로 생성하지 않음)
 * 경로: 내 드라이브 → LinguistAI → 스토어
 * @returns {string|null} 스토어 폴더 ID, 없으면 null
 */
export async function getStoreFolderId(accessToken) {
  const linguistFolderId = await findFolder(accessToken, null, 'LinguistAI');
  if (!linguistFolderId) return null;
  return findFolder(accessToken, linguistFolderId, '스토어');
}

// ── 파일 CRUD ─────────────────────────────────────────────────────────────────

/**
 * 보관함 폴더에 있는 팩 파일 목록을 가져옵니다.
 * @returns {Array<{id, name}>} 드라이브 파일 목록
 */
export async function listPackFiles(accessToken, folderId) {
  const q = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  await checkResponse(res, '파일 목록 조회 실패');
  const data = await res.json();
  return data.files || [];
}

/**
 * 파일 내용을 읽어서 팩 객체를 반환합니다.
 * @returns {Object} pack 객체
 */
export async function downloadPackFile(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await checkResponse(res, '파일 다운로드 실패');
  const text = await res.text();
  return JSON.parse(text);
}

/**
 * 팩을 드라이브에 업로드합니다. (신규 생성 or 기존 파일 덮어쓰기)
 * 파일명 규칙: {pack.title}.json (특수문자 제거, 최대 50자)
 * @param {string} accessToken
 * @param {string} folderId 보관함 폴더 ID
 * @param {Object} pack 팩 객체
 * @param {string|null} existingFileId 덮어쓸 기존 파일 ID (없으면 신규 생성)
 * @returns {string} 업로드된 파일 ID
 */
export async function uploadPack(accessToken, folderId, pack, existingFileId = null) {
  const safeTitle = (pack.title || pack.id)
    .replace(/[\/\\:*?"<>|]/g, '_')  // 파일명 불가 문자 → _
    .trim()
    .slice(0, 50);                    // 최대 50자
  const fileName = `${safeTitle}.json`;
  const content = JSON.stringify(pack, null, 2);
  const blob = new Blob([content], { type: 'application/json' });

  if (existingFileId) {
    // 기존 파일 내용 업데이트 (PATCH)
    const res = await fetch(
      `${DRIVE_UPLOAD_API}/files/${existingFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      }
    );
    await checkResponse(res, '파일 업데이트 실패');
    const data = await res.json();
    return data.id;
  } else {
    // 멀티파트 업로드로 신규 파일 생성
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json',
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    await checkResponse(res, '파일 업로드 실패');
    const data = await res.json();
    return data.id;
  }
}

/**
 * 드라이브에서 파일을 삭제합니다.
 */
export async function deletePackFile(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204 || res.status === 200) return; // 정상 삭제
  await checkResponse(res, '파일 삭제 실패');
}

// ── 고수준 API ────────────────────────────────────────────────────────────────

/**
 * 보관함 폴더에서 모든 팩을 로드합니다.
 * @returns {{ packs: Object[], driveFiles: Object[] }}
 *   packs: 파싱된 팩 객체 배열
 *   driveFiles: { packId, fileId } 매핑 배열 (업로드/삭제 시 사용)
 */
export async function loadAllPacks(accessToken) {
  const folderId = await getLibraryFolderId(accessToken);
  const files = await listPackFiles(accessToken, folderId);

  const results = await Promise.allSettled(
    files.map(async (f) => {
      const pack = await downloadPackFile(accessToken, f.id);
      return { pack, fileId: f.id };
    })
  );

  const packs = [];
  const driveFiles = [];

  for (const r of results) {
    if (r.status === 'fulfilled') {
      packs.push(r.value.pack);
      driveFiles.push({ packId: r.value.pack.id, fileId: r.value.fileId });
    }
  }

  return { packs, driveFiles, folderId };
}

/**
 * 팩을 보관함 드라이브 폴더에 저장합니다.
 * 드라이브에서 같은 제목의 파일을 검색해 있으면 덮어쓰고, 없으면 새로 생성합니다.
 * @returns {string} 드라이브 파일 ID
 */
export async function savePack(accessToken, pack, _driveFiles = [], folderId = null) {
  const resolvedFolderId = folderId ?? await getLibraryFolderId(accessToken);
  const safeTitle = (pack.title || pack.id)
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
    .slice(0, 50);
  const fileName = `${safeTitle}.json`;

  // 드라이브에서 같은 이름의 파일 검색
  const q = `name='${fileName.replace(/'/g, "\\'")}'  and '${resolvedFolderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  await checkResponse(res, '파일 검색 실패');
  const data = await res.json();
  const existingFileId = data.files?.[0]?.id ?? null;

  return uploadPack(accessToken, resolvedFolderId, pack, existingFileId);
}
