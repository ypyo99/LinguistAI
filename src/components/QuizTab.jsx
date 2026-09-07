import React, { useState, useEffect } from 'react';

const FALLBACK_WORDS = [
  'where', 'station', 'please', 'speak', 'book', 'table', 'two', 'nearest', 
  'train', 'slower', 'little', 'could', 'excuse', 'would', 'like', 'time',
  'name', 'help', 'much', 'cost', 'go', 'want', 'need', 'have', 'do'
];

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function cleanWord(word) {
  return word.replace(/[.,!?()]/g, '').toLowerCase();
}

export default function QuizTab({ sentences }) {
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null); // 'correct', 'wrong', or null
  const [shake, setShake] = useState(false);
  const [score, setScore] = useState(0);
  const [quizMode, setQuizMode] = useState('mixed'); // 'mixed', 'sentence', 'vocab'

  const generateQuiz = () => {
    if (!sentences || sentences.length === 0) return;

    // 1. Filter sentences based on mode if necessary
    let validSentences = sentences;
    if (quizMode === 'vocab') {
      validSentences = sentences.filter(s => s.vocab && Object.keys(s.vocab).length > 0);
      if (validSentences.length === 0) validSentences = sentences; // fallback
    }

    const randomSentenceIdx = Math.floor(Math.random() * validSentences.length);
    const sentenceObj = validSentences[randomSentenceIdx];
    const enText = sentenceObj.en;
    
    const words = enText.split(' ');
    
    // 2. Check if we can do a vocab quiz from the dynamic vocab object
    const vocabObj = sentenceObj.vocab || {};
    const vocabKeys = Object.keys(vocabObj);
    
    let wantVocabQuiz = false;
    if (quizMode === 'vocab') wantVocabQuiz = true;
    else if (quizMode === 'sentence') wantVocabQuiz = false;
    else wantVocabQuiz = Math.random() < 0.4;
    
    if (wantVocabQuiz && vocabKeys.length > 0) {
      const targetVocab = vocabKeys[Math.floor(Math.random() * vocabKeys.length)];
      const answerMeaning = vocabObj[targetVocab];
      
      // Gather distractors from all sentences that have a vocab object
      const allMeanings = [];
      sentences.forEach(s => {
        if (s.vocab) {
          Object.values(s.vocab).forEach(m => allMeanings.push(m));
        }
      });
      // Fallback distractor meanings if too few
      if (allMeanings.length < 4) {
        allMeanings.push('예약하다', '기차역', '시간', '어디에', '가장 가까운', '말하다', '천천히', '조금');
      }

      const optionsSet = new Set();
      optionsSet.add(answerMeaning);
      
      const shuffledMeanings = shuffleArray(allMeanings);
      for (const m of shuffledMeanings) {
        if (optionsSet.size >= 4) break;
        if (m !== answerMeaning) optionsSet.add(m);
      }
      
      const options = shuffleArray(Array.from(optionsSet));

      setQuizData({
        quizType: 'vocab-meaning',
        ko: sentenceObj.ko,
        en: sentenceObj.en,
        targetVocab,
        answer: answerMeaning,
        options,
      });
      setSelectedAnswer(null);
      setShake(false);
      return;
    }

    // 3. Decide if we want to blank 1 or 2 words (Fill in the blank mode)
    const numBlanks = (words.length >= 4 && Math.random() > 0.4) ? 2 : 1; 
    
    let blankIndices = [];
    let isConsecutive = false;
    let targetWordClean = '';

    if (numBlanks === 2) {
      isConsecutive = Math.random() > 0.5; // 50% chance for consecutive or non-consecutive
      
      const validIndices = words.map((w, idx) => idx).filter(idx => cleanWord(words[idx]).length > 0);
      
      if (isConsecutive) {
        const validStart = validIndices.filter(idx => validIndices.includes(idx + 1));
        const startIdx = validStart.length > 0 ? validStart[Math.floor(Math.random() * validStart.length)] : 0;
        blankIndices = [startIdx, startIdx + 1];
        targetWordClean = `${cleanWord(words[startIdx])} ${cleanWord(words[startIdx+1])}`;
      } else {
        const possiblePairs = [];
        for (let i = 0; i < validIndices.length; i++) {
          for (let j = i + 2; j < validIndices.length; j++) {
            possiblePairs.push([validIndices[i], validIndices[j]]);
          }
        }
        if (possiblePairs.length > 0) {
          blankIndices = possiblePairs[Math.floor(Math.random() * possiblePairs.length)];
          targetWordClean = `${cleanWord(words[blankIndices[0]])} ... ${cleanWord(words[blankIndices[1]])}`;
        } else {
          // fallback to 1 word if no valid pairs
          blankIndices = [validIndices[Math.floor(Math.random() * validIndices.length)]];
          targetWordClean = cleanWord(words[blankIndices[0]]);
        }
      }
    } else {
      const validIndices = words.map((w, idx) => idx).filter(idx => cleanWord(words[idx]).length > 2);
      const startIdx = validIndices.length > 0 
        ? validIndices[Math.floor(Math.random() * validIndices.length)] 
        : Math.floor(Math.random() * words.length);
      blankIndices = [startIdx];
      targetWordClean = cleanWord(words[startIdx]);
    }

    // 3. Create the segments array
    const segments = [];
    for (let i = 0; i < words.length; i++) {
      if (blankIndices.includes(i)) {
        if (isConsecutive && blankIndices.length === 2 && i === blankIndices[0]) {
          const punctuationMatch = words[i+1].match(/[.,!?()]+$/);
          const punctuation = punctuationMatch ? punctuationMatch[0] : '';
          segments.push({ isBlank: true, wordText: targetWordClean, punctuation });
          i++; // skip next word
        } else {
          const punctuationMatch = words[i].match(/[.,!?()]+$/);
          const punctuation = punctuationMatch ? punctuationMatch[0] : '';
          segments.push({ isBlank: true, wordText: cleanWord(words[i]), punctuation });
        }
      } else {
        segments.push({ isBlank: false, wordText: words[i] });
      }
    }

    // 4. Generate options (1 correct + 3 distractors)
    const optionsSet = new Set();
    optionsSet.add(targetWordClean);

    if (blankIndices.length === 2) {
      const allOtherPairs = [];
      sentences.filter((_, idx) => idx !== randomSentenceIdx).forEach(s => {
        const sWords = s.en.split(' ');
        if (isConsecutive) {
          for(let i = 0; i < sWords.length - 1; i++) {
            const w1 = cleanWord(sWords[i]);
            const w2 = cleanWord(sWords[i+1]);
            if(w1 && w2) allOtherPairs.push(`${w1} ${w2}`);
          }
        } else {
          for(let i = 0; i < sWords.length - 2; i++) {
            for(let j = i + 2; j < sWords.length; j++) {
              const w1 = cleanWord(sWords[i]);
              const w2 = cleanWord(sWords[j]);
              if(w1 && w2) allOtherPairs.push(`${w1} ... ${w2}`);
            }
          }
        }
      });
      const fallbackPairs = isConsecutive 
        ? ['would you', 'thank you', 'how much', 'over there', 'excuse me', 'could you', 'very good', 'a little', 'want to', 'looking for']
        : ['would ... like', 'how ... much', 'where ... is', 'could ... please', 'can ... get', 'thank ... for', 'what ... time'];
      
      const distractorPool = shuffleArray([...allOtherPairs, ...fallbackPairs]);
      for (const pair of distractorPool) {
        if (optionsSet.size >= 4) break;
        if (!optionsSet.has(pair)) optionsSet.add(pair);
      }
    } else {
      const allOtherWords = sentences
        .filter((_, idx) => idx !== randomSentenceIdx)
        .flatMap(s => s.en.split(' ').map(cleanWord))
        .filter(w => w.length > 2 && w !== targetWordClean);
      const distractorPool = shuffleArray([...allOtherWords, ...FALLBACK_WORDS]);
      for (const word of distractorPool) {
        if (optionsSet.size >= 4) break;
        if (!optionsSet.has(word)) optionsSet.add(word);
      }
    }

    const options = shuffleArray(Array.from(optionsSet));

    setQuizData({
      quizType: 'fill-in-the-blank',
      ko: sentenceObj.ko,
      en: sentenceObj.en,
      segments,
      answer: targetWordClean,
      options,
    });
    setSelectedAnswer(null);
    setShake(false);
  };

  useEffect(() => {
    if (sentences && sentences.length > 0) {
      generateQuiz();
    }
  }, [sentences, quizMode]);

  const handleOptionClick = (option) => {
    if (selectedAnswer === 'correct') return; // Prevent clicking after correct

    if (option === quizData.answer) {
      setSelectedAnswer('correct');
      setScore(s => s + 1);
      setTimeout(() => {
        generateQuiz();
      }, 1200); // Wait a bit before next question
    } else {
      setSelectedAnswer('wrong');
      setShake(true);
      setTimeout(() => setShake(false), 500); // Remove shake class
    }
  };

  if (!sentences || sentences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-amber">
        <i className="material-symbols-outlined text-6xl mb-4">inventory_2</i>
        <h2 className="text-xl font-bold mb-2">데이터가 없습니다</h2>
        <p>학습할 문장을 먼저 생성하거나 스토어에서 가져와주세요.</p>
      </div>
    );
  }

  if (!quizData) return null;

  return (
    <div className="flex flex-col flex-1 h-full items-center justify-between py-6 px-4 tab-fade-in relative">
      
      {/* Top Section */}
      <div className="w-full max-w-2xl flex flex-row justify-between items-center mb-6 px-1 sm:px-2 gap-1 sm:gap-4">
        {/* Score */}
        <div className="text-xs sm:text-sm font-bold text-teal-deep bg-teal-tint px-2 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm whitespace-nowrap flex-shrink-0">
          <span className="hidden sm:inline">점수: </span>{score}점
        </div>
        
        {/* Mode Toggle */}
        <div className="flex flex-row justify-center bg-amber-tint/60 p-1 sm:p-1.5 rounded-2xl shadow-inner text-xs sm:text-sm font-semibold gap-0.5 sm:gap-2 border border-line/50 flex-shrink min-w-0">
          <button 
            onClick={() => setQuizMode('mixed')}
            className={`px-1.5 sm:px-5 py-1.5 sm:py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-0.5 sm:gap-1.5 ${quizMode === 'mixed' ? 'btn-orange shadow-md transform scale-105 font-bold' : 'text-ink-soft hover:bg-white/60 hover:text-ink'}`}
          >
            <i className="material-symbols-outlined text-[14px] sm:text-[18px]">shuffle</i>
            <span className="whitespace-nowrap">랜덤</span>
          </button>
          <button 
            onClick={() => setQuizMode('sentence')}
            className={`px-1.5 sm:px-5 py-1.5 sm:py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-0.5 sm:gap-1.5 ${quizMode === 'sentence' ? 'btn-orange shadow-md transform scale-105 font-bold' : 'text-ink-soft hover:bg-white/60 hover:text-ink'}`}
          >
            <i className="material-symbols-outlined text-[14px] sm:text-[18px]">short_text</i>
            <span className="whitespace-nowrap">문장</span>
          </button>
          <button 
            onClick={() => setQuizMode('vocab')}
            className={`px-1.5 sm:px-5 py-1.5 sm:py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-0.5 sm:gap-1.5 ${quizMode === 'vocab' ? 'btn-orange shadow-md transform scale-105 font-bold' : 'text-ink-soft hover:bg-white/60 hover:text-ink'}`}
          >
            <i className="material-symbols-outlined text-[14px] sm:text-[18px]">lightbulb</i>
            <span className="whitespace-nowrap">단어</span>
          </button>
        </div>

        {/* Skip Button */}
        <button onClick={generateQuiz} className="text-xs sm:text-sm text-ink-soft flex items-center justify-center gap-0.5 sm:gap-1 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-full shadow-sm whitespace-nowrap flex-shrink-0">
          <i className="material-symbols-outlined text-[14px] sm:text-[18px]">skip_next</i>
          <span className="hidden sm:inline">건너뛰기</span>
          <span className="sm:hidden">패스</span>
        </button>
      </div>

      {/* Main Question Area */}
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-2xl mb-8">
        {quizData.quizType === 'vocab-meaning' ? (
          <>
            <p className="text-lg md:text-xl text-ink-soft mb-6 font-semibold text-center leading-relaxed flex flex-wrap justify-center gap-x-1 sm:gap-x-1.5 gap-y-1">
              {quizData.en.split(' ').map((w, i) => {
                const cw = cleanWord(w).toLowerCase();
                const tv = quizData.targetVocab.toLowerCase();
                // AI may return base forms (e.g. booked -> book)
                const isTarget = cw === tv || cw.startsWith(tv) || tv.startsWith(cw);
                return (
                  <span key={i} className={isTarget ? 'text-teal-deep font-bold border-b-2 border-teal-deep pb-0.5' : ''}>
                    {w}
                  </span>
                );
              })}
            </p>
            <div className={`quiz-sentence-box bg-white p-5 sm:p-8 md:p-10 rounded-3xl shadow-lg border-2 w-full text-center
              ${selectedAnswer === 'correct' ? 'border-green-400 bg-green-50 shadow-green-100' : 'border-teal-tint'}
              transition-colors duration-300`}>
              <div className="text-base sm:text-lg md:text-xl font-bold text-ink-soft mb-2">이 문장에서 밑줄 친 단어의 뜻은?</div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-ink leading-relaxed md:leading-tight tracking-tight">
                {quizData.targetVocab}
              </h2>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg md:text-xl text-ink-soft mb-6 font-semibold text-center break-keep">
              {quizData.ko}
            </p>
            
            <div className={`quiz-sentence-box bg-white p-5 sm:p-8 md:p-10 rounded-3xl shadow-lg border-2 w-full text-center
              ${selectedAnswer === 'correct' ? 'border-green-400 bg-green-50 shadow-green-100' : 'border-teal-tint'}
              transition-colors duration-300`}>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-ink leading-relaxed md:leading-tight tracking-tight flex flex-wrap justify-center items-center gap-x-2 gap-y-3">
                {quizData.segments.map((seg, i) => {
                  if (seg.isBlank) {
                    const isCorrect = selectedAnswer === 'correct';
                    const displayWord = isCorrect ? seg.wordText : (seg.wordText.includes(' ') ? '_____ _____' : '_____');
                    return (
                      <span key={i} className={`inline-block pb-1 border-b-4 
                        ${isCorrect ? 'text-green-500 border-green-500' : 'text-teal-deep border-teal'}`}>
                        {displayWord}{seg.punctuation}
                      </span>
                    );
                  }
                  return <span key={i}>{seg.wordText}</span>;
                })}
              </h2>
            </div>
          </>
        )}
        
        {/* Feedback Message */}
        <div className="h-12 mt-4 flex items-center justify-center">
          {selectedAnswer === 'correct' && (
            <span className="text-xl font-bold text-green-500 flex items-center gap-2 animate-bounce">
              <i className="material-symbols-outlined text-3xl">check_circle</i>
              정답입니다!
            </span>
          )}
        </div>
      </div>

      {/* Options Grid */}
      <div className={`w-full max-w-2xl grid grid-cols-2 gap-3 md:gap-6 ${shake ? 'quiz-shake' : ''}`}>
        {quizData.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleOptionClick(option)}
            className={`quiz-option-btn relative overflow-hidden bg-white hover:bg-teal-tint active:bg-teal-deep text-ink hover:text-teal-deep active:text-white font-bold py-5 md:py-8 rounded-2xl shadow-md border border-line transition-all break-words
              ${quizData.quizType === 'vocab-meaning' ? 'text-base sm:text-lg md:text-xl lg:text-2xl' : 'text-lg sm:text-xl md:text-3xl'}`}
          >
            {option}
          </button>
        ))}
      </div>
      
    </div>
  );
}
