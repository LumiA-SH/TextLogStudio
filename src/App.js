import React, {useEffect, useRef, useState} from 'react';
import {parseLog, speakersOf, uid} from './parser';
import {downloadText, exportHtml} from './exporter';
import {loadProject, saveProject} from './storage';

const example = `늦은 밤, 마지막 열차가 떠난 역에는 세 사람만 남아 있었다.

    역무실의 시계는 11시 59분을 가리키고 있었다. 이상하게도 초침은 움직이지 않았다.

    하린: "그러니까, 여기서 잃어버린 물건을 찾을 수 있다는 거죠?"

하린은 낡은 접수증을 책상 위에 내려놓았다.

    서윤: "그렇게 들었어. 근데 영업시간이 자정부터 새벽 한 시까지래."

도윤 K. 리드: "그런 보관소가 어디 있어요?"

서윤: "그러게. 그런데 너 아까부터 왜 자꾸 뒤를 봐?"`;

const blank = () => ({
  title: '새로운 로그',
  raw: '',
  blocks: [],
  characters: {},
  background: '',
  theme: 'system'
});

const SPEAKER_COLORS = [
  '#A68EE2', '#79C9B8', '#E5A7BC', '#D4B37B',
  '#8DB7E3', '#C0A3EE', '#E49C82', '#89B87A',
  '#D28BC3', '#78BFCB', '#E0B76A', '#A0A6E8',
  '#D68F96', '#8CC7A2', '#C4A0D5', '#C5B48A'
];

const randomColor = i => SPEAKER_COLORS[i % SPEAKER_COLORS.length];

const validProject = data => data && typeof data === 'object'
    && Array.isArray(data.blocks)
    && typeof data.raw === 'string'
    && typeof data.title === 'string';

const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const imageFile = file => file && /^image\/(png|jpeg|gif|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024;

function HelpModal({activeTab, setActiveTab, onClose}) {
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
      <div className="help-overlay" onMouseDown={e => {if (e.target === e.currentTarget) onClose();}}>
        <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div className="help-header">
            <div>
              <h2 id="help-title">TRPG LOG STUDIO 사용법</h2>
              <p>텍스트 로그를 편집하고 HTML로 내보내는 방법</p>
            </div>
            <button type="button" className="help-close" aria-label="도움말 닫기" onClick={onClose}>×</button>
          </div>

          <div className="help-tabs">
            <button className={activeTab === 'start' ? 'active' : ''} onClick={() => setActiveTab('start')}>시작하기</button>
            <button className={activeTab === 'format' ? 'active' : ''} onClick={() => setActiveTab('format')}>TXT 작성 규칙</button>
            <button className={activeTab === 'edit' ? 'active' : ''} onClick={() => setActiveTab('edit')}>블록 편집</button>
            <button className={activeTab === 'export' ? 'active' : ''} onClick={() => setActiveTab('export')}>디자인 / 내보내기</button>
          </div>

          <div className="help-content">
            {activeTab === 'start' && (
                <>
                  <h3>01. 원문 가져오기</h3>
                  <p>왼쪽 메뉴의 <strong>01 · 원문 가져오기</strong>에서 TXT 파일을 불러오거나 로그를 직접 붙여넣으세요.</p>
                  <p><strong>일반 모드 분석 →</strong> 또는 <strong>확장 모드 분석 →</strong> 버튼을 누르면 원문이 화자 대사, GM 서술, 장면 제목 블록으로 변환됩니다.</p>

                  <h3>02. 편집하기</h3>
                  <p>분석이 끝나면 <strong>02 · 블록 편집</strong> 화면으로 이동합니다. 각 블록의 내용, 유형, 순서를 직접 수정할 수 있습니다.</p>
                  <p>오른쪽 LIVE PREVIEW에서 편집 결과를 바로 확인할 수 있습니다.</p>

                  <h3>03. 프로젝트 저장하기</h3>
                  <p>프로젝트는 서버가 아닌 <strong>현재 사용 중인 브라우저의 로컬 저장소(IndexedDB)</strong>에 자동 저장됩니다.</p>
                  <p>중요한 작업은 상단의 <strong>JSON 백업</strong> 버튼으로 별도 보관하세요. <strong>JSON 불러오기</strong>를 사용하면 백업한 프로젝트를 다시 열고 편집할 수 있습니다.</p>

                  <div className="help-notice">
                    <strong>데이터 저장 및 백업 안내</strong>
                    <p>브라우저의 사이트 데이터 삭제, 저장 공간 정리, 브라우저 초기화 등을 진행하면 자동 저장된 작업 내용이 사라질 수 있습니다.</p>
                    <p>일반적인 캐시 삭제만으로는 보통 작업 내용이 삭제되지 않지만, <strong>사이트 데이터까지 삭제하면 복구할 수 없을 수 있으므로</strong> 중요한 로그는 반드시 JSON 파일로 백업해 주세요.</p>
                    <p>저장된 프로젝트는 다른 브라우저나 기기로 자동 공유되지 않습니다.</p>
                    <p>원문을 다시 자동 분석하면 기존 블록의 수정 사항이 교체될 수 있습니다. 재분석 전에는 JSON 백업을 권장합니다.</p>
                  </div>
                </>
            )}

            {activeTab === 'format' && (
                <>
                  <h3>TXT 로그 작성 규칙</h3>
                  <p>화자 이름과 줄바꿈을 기준으로 로그를 분석합니다. 원문을 작성한 방식에 맞춰 <strong>일반 모드</strong> 또는 <strong>확장 모드</strong> 분석 버튼을 선택하세요.</p>

                  <h3>분석 모드 비교</h3>
                  <table className="help-table">
                    <thead>
                    <tr><th>작성 방법</th><th>일반 모드</th><th>확장 모드</th></tr>
                    </thead>
                    <tbody>
                    <tr><td><code>캐릭터 A: 대사</code></td><td>화자 블록 시작</td><td>화자 블록 시작</td></tr>
                    <tr><td>빈 줄 1개</td><td>화자 블록 종료</td><td>같은 블록의 문단 구분</td></tr>
                    <tr><td>빈 줄 2개</td><td>화자 블록 종료</td><td>화자 블록 종료</td></tr>
                    <tr><td><code>캐릭터 B: 대사</code></td><td>새 화자 블록 시작</td><td>새 화자 블록 시작</td></tr>
                    <tr><td><code># 장면 제목</code></td><td>장면 제목 블록</td><td>장면 제목 블록</td></tr>
                    </tbody>
                  </table>

                  <h3>일반 모드 작성 예시</h3>
                  <p>대사와 나레이션 사이에 빈 줄 하나를 두는 일반적인 TXT 로그에 적합합니다.</p>
                  <pre className="help-example">{`캐릭터 A: "문을 열어보겠습니다."

문이 열리자 어두운 복도가 나타납니다.

캐릭터 B: "안쪽을 확인해 볼게요."`}</pre>

                  <h3>확장 모드 작성 예시</h3>
                  <p>화자의 대사와 행동 묘사를 하나의 블록으로 묶고 싶을 때 사용합니다. 빈 줄 하나는 같은 블록으로 연결하고, 나레이션으로 넘어갈 때 빈 줄 두 개를 둡니다.</p>
                  <pre className="help-example">{`캐릭터 A: "문을 열어보겠습니다."

조심스럽게 문고리를 잡고 돌린다.


문이 열리자 어두운 복도가 나타납니다.

캐릭터 B: "안쪽을 확인해 볼게요."`}</pre>

                  <h3>알아두기</h3>
                  <p>화자 이름은 <code>이름:</code> 또는 <code>이름：</code> 형태로 작성할 수 있습니다. 채널이 포함된 화자 표기도 지원합니다.</p>
                  <p>화자 이름 없이 작성된 문장은 선택한 모드의 빈 줄 규칙에 따라 화자 블록에 포함되거나 나레이션으로 처리됩니다.</p>
                  <div className="help-notice">일반 모드와 확장 모드는 분석할 때만 적용됩니다. 이미 분석한 블록은 직접 수정할 수 있으며, 다른 모드로 다시 분석하면 기존 블록의 수정 내용이 교체될 수 있습니다.</div>
                </>
          )}

            {activeTab === 'edit' && (
                <>
                  <h3>01. 블록 편집</h3>
                  <p><strong>02 · 블록 편집</strong>에서 분석된 로그를 수정할 수 있습니다.</p>
                  <p>각 블록의 유형은 <strong>화자 / 나레이션 / 장면 제목 / 이미지</strong> 중에서 선택할 수 있습니다.</p>

                  <h3>02. 블록 관리</h3>
                  <p><strong>↑ ↓</strong> 버튼으로 블록 순서를 변경하고, <strong>복제</strong> 또는 <strong>삭제</strong>할 수 있습니다.</p>
                  <p>화자 블록, 나레이션, 장면 제목, 장면 이미지를 직접 추가할 수도 있습니다.</p>

                  <h3>03. 캐릭터 관리</h3>
                  <p><strong>03 · 캐릭터 / 이미지</strong>에서 화자별 색상과 인장 이미지를 설정할 수 있습니다.</p>
                  <p>이미지는 PNG, JPG, GIF, WebP 형식을 지원하며 파일당 최대 8MB입니다. 캐릭터 인장은 정사각형 이미지를 권장합니다.</p>

                  <div className="help-notice">자동 분석 결과가 원하는 형태와 다르다면 원문을 다시 작성하지 않고도 블록 유형과 내용을 직접 수정할 수 있습니다.</div>
                </>
            )}

            {activeTab === 'export' && (
                <>
                  <h3>01. 로그 디자인</h3>
                  <p><strong>04 · 디자인</strong>에서 로그의 테마와 배경 이미지를 설정할 수 있습니다.</p>
                  <p>로그 테마는 <strong>시스템 따라가기 / 다크 / 라이트</strong> 중에서 선택합니다.</p>
                  <p>상단의 프로그램 다크·라이트 모드는 편집기 화면 설정이며, 로그 테마와는 별도로 관리됩니다.</p>

                  <h3>02. 실시간 미리보기</h3>
                  <p>오른쪽 LIVE PREVIEW에서 편집 결과를 확인할 수 있습니다. 편집 공간이 필요하면 <strong>미리보기 접기</strong>를 이용하세요.</p>

                  <h3>03. HTML 내보내기</h3>
                  <p>상단의 <strong>HTML 내보내기</strong> 버튼을 누르면 독립 HTML 파일을 생성합니다.</p>
                  <p>등록한 캐릭터 인장과 배경 이미지는 HTML 파일 내부에 포함됩니다.</p>
                  <p>티스토리에 사용할 때는 HTML 편집 모드에서 내보낸 HTML 내용을 적용하세요.</p>

                  <div className="help-notice">HTML은 게시용 결과물입니다. 나중에 다시 편집하려면 JSON 프로젝트 백업을 함께 보관하세요.</div>
                </>
            )}
          </div>

          <div className="help-footer">
            <span>TEXT LOG STUDIO · GUIDE</span>
            <button type="button" onClick={onClose}>닫기</button>
          </div>
        </div>
      </div>
  );
}

export default function App() {
  const [project, setProject] = useState(blank);
  const [storageReady, setStorageReady] = useState(false);
  const [tab, setTab] = useState('source');
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [helpTab, setHelpTab] = useState('start');
  const sourceRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  const [systemTheme, setSystemTheme] = useState(() => {
    return localStorage.getItem('trpg-log-studio-system-theme') || 'dark';
  });

  const logTheme = project.theme === 'light' || project.theme === 'dark'
      ? project.theme
      : systemTheme;

  useEffect(() => {
    localStorage.setItem('trpg-log-studio-system-theme', systemTheme);
  }, [systemTheme]);

  const update = patch => setProject(prev => ({...prev, ...patch}));

  const updateBlock = (id, patch) => {
    setProject(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? {...b, ...patch} : b)
    }));
  };

  const names = speakersOf(project.blocks);
  const characters = {...project.characters};

  names.forEach((name, i) => {
    if (!characters[name]) characters[name] = {color: randomColor(i), image: ''};
  });

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const saved = await loadProject();

        if (!active) return;

        if (validProject(saved)) {
          setProject(saved);
          setSavedAt('불러오기 완료');
        }
      } catch (error) {
        if (!active) return;
        console.error('프로젝트 불러오기 실패:', error);
        setStatus('저장된 프로젝트를 불러오지 못했습니다. 브라우저 저장소를 확인해 주세요.');
      } finally {
        if (active) setStorageReady(true);
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const version = ++saveVersion.current;

    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (version !== saveVersion.current) return;

        try {
          await saveProject(project);

          if (version === saveVersion.current) {
            setSavedAt(new Date().toLocaleTimeString('ko-KR'));
          }
        } catch (error) {
          console.error('프로젝트 저장 실패:', error);

          if (version === saveVersion.current) {
            setStatus('프로젝트 자동 저장에 실패했습니다. JSON으로 백업해 주세요.');
          }
        }
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [project, storageReady]);

  const parse = (mode = 'extended') => {
    if (project.blocks.length && !window.confirm('현재 편집한 블록을 새 분석 결과로 교체할까요? 기존 블록 수정 사항은 사라집니다.')) return;

    const blocks = parseLog(project.raw, mode);
    const next = {...characters};

    speakersOf(blocks).forEach((name, i) => {
      if (!next[name]) next[name] = {color: randomColor(i), image: ''};
    });

    update({blocks, characters: next});
    setTab('edit');
    setStatus(`${mode === 'simple' ? '일반' : '확장'} 모드로 ${blocks.length}개 블록을 분석했습니다. 결과를 직접 수정할 수 있습니다.`);
  };

  const changeCharacter = (name, patch) => {
    update({characters: {...characters, [name]: {...characters[name], ...patch}}});
  };

  const uploadImage = async (file, callback) => {
    if (!file) return;

    if (!imageFile(file)) {
      setStatus('이미지는 PNG/JPG/GIF/WebP, 파일당 8MB 이하만 지원합니다.');
      return;
    }

    try {
      callback(await fileToDataUrl(file));
    } catch {
      setStatus('이미지를 읽지 못했습니다.');
    }
  };

  const saveJson = () => {
    downloadText(JSON.stringify(project, null, 2), `${safeName(project.title)}.json`, 'application/json;charset=utf-8');
  };

  const loadJson = async file => {
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());
      if (!validProject(data)) throw Error();
      if (project.blocks.length && !window.confirm('현재 작업을 불러온 프로젝트로 교체할까요?')) return;

      update({
        ...blank(),
        ...data,
        blocks: data.blocks.map(b => ({...b, id: b.id || uid()})),
        characters: data.characters || {}
      });

      setStatus('프로젝트를 불러왔습니다.');
    } catch {
      setStatus('올바른 프로젝트 JSON 파일이 아닙니다.');
    }
  };

  const addBlock = type => {
    const block = {id: uid(), type, speaker: names[0] || '', text: '', image: ''};

    update({blocks: [...project.blocks, block]});
    setSelected(block.id);
    setTab('edit');
  };

  const move = (id, step) => {
    const arr = [...project.blocks];
    const i = arr.findIndex(b => b.id === id);
    const j = i + step;

    if (j < 0 || j >= arr.length) return;

    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({blocks: arr});
  };

  const remove = id => {
    update({blocks: project.blocks.filter(b => b.id !== id)});
    if (selected === id) setSelected(null);
  };

  const exportFile = () => {
    downloadText(exportHtml({...project, characters, theme: logTheme}), `${safeName(project.title)}.html`, 'text/html;charset=utf-8');
    setStatus('독립 HTML을 내보냈습니다. 이미지도 파일 안에 포함됩니다.');
  };

  const reset = () => {
    if (window.confirm('새 프로젝트를 시작할까요? 현재 내용은 지워집니다. 먼저 JSON 백업을 권장합니다.')) {
      setProject(blank());
      setSelected(null);
      setTab('source');
    }
  };

  if (!storageReady) {
    return <div className="app" style={{padding: 30}}>프로젝트를 불러오는 중입니다...</div>;
  }

  return (
      <div className={`app ${systemTheme === 'light' ? 'app-light' : 'app-dark'}`}>
        <header className="topbar">
          <div className="topbar-left">
            <div className="brand">
                        <span className="brand-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/>
                                <path d="M2 6h4M2 10h4M2 14h4M2 18h4"/>
                                <path d="M21.378 5.626a1 1 0 0 0-3.004-3.004l-8.01 8.01a2 2 0 0 0-.506.854l-.837 3.348a.5.5 0 0 0 .606.606l3.348-.837a2 2 0 0 0 .854-.506z"/>
                            </svg>
                        </span>
              <div>
                <strong>TEXT LOG STUDIO</strong>
                <small>텍스트 파일을 로그처럼</small>
              </div>
            </div>

            <div className="system-theme-area">
              <div className="system-theme-switch">
                <button type="button" className={systemTheme === 'dark' ? 'active' : ''} onClick={() => setSystemTheme('dark')}>다크모드</button>
                <button type="button" className={systemTheme === 'light' ? 'active' : ''} onClick={() => setSystemTheme('light')}>라이트모드</button>
              </div>
              <small className="system-theme-help">로그 테마와 프리뷰는 04 · 디자인에서 별도로 설정할 수 있습니다.</small>
            </div>
          </div>

          <div className="toolbar">
            <span className="save-status">{savedAt ? `자동 저장 ${savedAt}` : '저장 준비 중'}</span>
            <button type="button" onClick={() => {setHelpTab('start'); setShowHelp(true);}}>ⓘ 사용법</button>
            <button onClick={reset}>새 프로젝트</button>
            <button onClick={saveJson}>JSON 백업</button>
            <label className="button">
              JSON 불러오기
              <input type="file" accept=".json,application/json" hidden onChange={e => {
                loadJson(e.target.files?.[0]);
                e.target.value = '';
              }}/>
            </label>
            <button className="primary" onClick={exportFile} disabled={!project.blocks.length}>HTML 내보내기</button>
          </div>
        </header>

        <div className="workspace">
          <aside className="sidebar">
            <label className="field-label">로그 제목</label>
            <input value={project.title} onChange={e => update({title: e.target.value})}/>

            <div className="section-label">편집 단계</div>
            <nav className="tabs">
              <button className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>01 · 원문 가져오기</button>
              <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>
                02 · 블록 편집 <span>{project.blocks.length}</span>
              </button>
              <button className={tab === 'characters' ? 'active' : ''} onClick={() => setTab('characters')}>03 · 캐릭터 / 이미지</button>
              <button className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>04 · 디자인</button>
            </nav>

            <div className="sidebar-note">
              원문과 편집 결과는 별도로 유지됩니다. 자동 저장은 현재 브라우저에만 적용되므로 중요한 작업은 JSON으로 백업하세요.
            </div>
          </aside>

          <section className="editor">
            <div className="editor-head">
              <div>
                <h2>
                  {tab === 'source' ? '원문 가져오기'
                      : tab === 'edit' ? '블록 편집'
                          : tab === 'characters' ? '캐릭터 관리'
                              : '디자인 설정'}
                </h2>
                <p>
                  {tab === 'source' ? 'TXT 파일 또는 직접 입력. 화자 표기와 줄바꿈 규칙을 기준으로 분석합니다.'
                      : tab === 'edit' ? '자동 분석 결과를 직접 고치고, 유형과 순서를 변경하세요.'
                          : tab === 'characters' ? '인장 이미지를 직접 등록하고 캐릭터별 색상을 지정하세요.\n캐릭터 이미지는 정사각형을 권장합니다.'
                              : '배포할 로그의 분위기를 설정하세요.'}
                </p>
              </div>
              <button className="preview-toggle" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? '미리보기 접기' : '미리보기 열기'}
              </button>
            </div>

            {tab === 'source' && (
                <div className="source-panel">
                  <div className="inline">
                    <label className="button">
                      TXT 불러오기
                      <input type="file" accept=".txt,text/plain" hidden onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f) update({raw: await f.text()});
                        e.target.value = '';
                      }}/>
                    </label>
                    <button onClick={() => update({raw: example})}>예제 넣기</button>
                    <span className="muted">원문은 재분석 전까지 편집 결과에 영향을 주지 않습니다.</span>
                  </div>

                  <div className="source-help-row">
                    <button type="button" className="source-help-link" onClick={() => {setHelpTab('format'); setShowHelp(true);}}>ⓘ TXT 작성 규칙 보기</button>
                  </div>

                  <textarea ref={sourceRef} className="source-text" spellCheck={false} value={project.raw} placeholder={'하린: "그러니까, 여기서 잃어버린 물건을 찾을 수 있다는 거죠?"\n\n하린은 낡은 접수증을 책상 위에 내려놓았다.\n\n\n문밖에서 낯선 발소리가 들려옵니다.'} onChange={e => update({raw: e.target.value})}/>

                  <div className="inline end">
                    <span className="muted">{project.raw.length.toLocaleString()}자</span>
                    <button onClick={() => parse('extended')} disabled={!project.raw.trim()}>확장 모드 분석 →</button>
                    <button className="primary" onClick={() => parse('simple')} disabled={!project.raw.trim()}>일반 모드 분석 →</button>
                  </div>
                </div>
            )}

            {tab === 'edit' && (
                <div className="blocks-panel">
                  <div className="inline block-actions">
                    <button onClick={() => addBlock('speaker')}>+ 화자 블록</button>
                    <button onClick={() => addBlock('narration')}>+ 나레이션</button>
                    <button onClick={() => addBlock('heading')}>+ 장면 제목</button>
                    <button onClick={() => addBlock('image')}>+ 장면 이미지</button>
                  </div>

                  {!project.blocks.length && (
                      <div className="empty">아직 블록이 없습니다. 원문을 분석하거나 새 블록을 추가해 주세요.</div>
                  )}

                  {project.blocks.map((b, i) => (
                      <article key={b.id} className={`block-card ${selected === b.id ? 'selected' : ''}`} onClick={() => setSelected(b.id)}>
                        <div className="block-top">
                          <span className="block-number">#{String(i + 1).padStart(3, '0')}</span>
                          <select aria-label="블록 유형" value={b.type} onChange={e => updateBlock(b.id, {type: e.target.value})}>
                            <option value="speaker">화자</option>
                            <option value="narration">나레이션</option>
                            <option value="heading">장면 제목</option>
                            <option value="image">이미지</option>
                          </select>

                          <div className="block-buttons">
                            <button title="위로" disabled={i === 0} onClick={() => move(b.id, -1)}>↑</button>
                            <button title="아래로" disabled={i === project.blocks.length - 1} onClick={() => move(b.id, 1)}>↓</button>
                            <button title="복제" onClick={() => {
                              const arr = [...project.blocks];
                              arr.splice(i + 1, 0, {...b, id: uid()});
                              update({blocks: arr});
                            }}>복제</button>
                            <button className="danger" title="삭제" onClick={() => remove(b.id)}>삭제</button>
                          </div>
                        </div>

                        {b.type === 'speaker' && (
                            <div className="speaker-input">
                              <label>화자</label>
                              <input list="speaker-list" value={b.speaker || ''} onChange={e => updateBlock(b.id, {speaker: e.target.value})}/>
                              <datalist id="speaker-list">
                                {names.map(n => <option key={n} value={n}/>)}
                              </datalist>
                            </div>
                        )}

                        {b.type === 'image' && (
                            <div className="image-input">
                              <label className="button">
                                장면 이미지 등록
                                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => {
                                  uploadImage(e.target.files?.[0], image => updateBlock(b.id, {image}));
                                  e.target.value = '';
                                }}/>
                              </label>
                              {b.image && <img src={b.image} alt="장면 미리보기"/>}
                              <button onClick={() => updateBlock(b.id, {image: ''})}>이미지 제거</button>
                            </div>
                        )}

                        <textarea rows={b.type === 'heading' || b.type === 'image' ? 2 : 4} value={b.text} placeholder={b.type === 'image' ? '이미지 설명 (선택)' : '내용을 입력하세요'} onChange={e => updateBlock(b.id, {text: e.target.value})}/>
                      </article>
                  ))}
                </div>
            )}

            {tab === 'characters' && (
                <div className="characters-panel">
                  {!names.length && <div className="empty">화자 블록을 추가하면 캐릭터가 여기에 표시됩니다.</div>}

                  {names.map(name => (
                      <div className="character-card" key={name}>
                        <div className="character-avatar">
                          {characters[name].image
                              ? <img src={characters[name].image} alt=""/>
                              : <span style={{color: characters[name].color}}>{name.slice(0, 1)}</span>}
                        </div>

                        <div className="character-controls">
                          <strong>{name}</strong>
                          <div className="inline">
                            <label>
                              화자 색상
                              <input type="color" value={characters[name].color || '#a68ee2'} onChange={e => changeCharacter(name, {color: e.target.value})}/>
                            </label>
                            <label className="button">
                              인장 등록
                              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => {
                                uploadImage(e.target.files?.[0], image => changeCharacter(name, {image}));
                                e.target.value = '';
                              }}/>
                            </label>
                            <button onClick={() => changeCharacter(name, {image: ''})}>인장 제거</button>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
            )}

            {tab === 'design' && (
                <div className="design-panel">
                  <label className="field-label">로그 테마</label>
                  <div className="inline">
                    <button className={project.theme === 'system' ? 'primary' : ''} onClick={() => update({theme: 'system'})}>시스템 따라가기</button>
                    <button className={project.theme === 'dark' ? 'primary' : ''} onClick={() => update({theme: 'dark'})}>다크</button>
                    <button className={project.theme === 'light' ? 'primary' : ''} onClick={() => update({theme: 'light'})}>라이트</button>
                  </div>

                  <label className="field-label">배경 이미지 (선택)</label>
                  <div className="inline">
                    <label className="button">
                      배경 등록
                      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => {
                        uploadImage(e.target.files?.[0], background => update({background}));
                        e.target.value = '';
                      }}/>
                    </label>
                    <button onClick={() => update({background: ''})}>배경 제거</button>
                  </div>

                  {project.background && <img className="background-sample" src={project.background} alt="배경 미리보기"/>}
                  <p className="muted">이미지는 HTML에 직접 포함됩니다. 이미지가 많거나 크면 결과 HTML 파일도 커집니다.</p>
                </div>
            )}
          </section>

          {showPreview && (
              <aside className={`preview-panel ${logTheme === 'light' ? 'light' : 'dark'}`}>
                <div className="preview-head">
                  <strong>LIVE PREVIEW</strong>
                  <span>{project.blocks.length} blocks</span>
                </div>

                <div className="preview-scroll" style={project.background ? {
                  backgroundImage: `linear-gradient(${logTheme === 'light' ? '#ffffffdf,#ffffffed' : '#191919dd,#191919ed'}),url(${project.background})`
                } : {}}>
                  <h1>{project.title}</h1>
                  {!project.blocks.length && <p className="preview-empty">로그가 이곳에 표시됩니다.</p>}

                  {project.blocks.map(b => {
                    if (b.type === 'heading') {
                      return <h3 className="log-heading" key={b.id}>{b.text}</h3>;
                    }

                    if (b.type === 'narration') {
                      return <div className="log-narration" key={b.id}>{b.text}</div>;
                    }

                    if (b.type === 'image') {
                      return (
                          <div className="log-scene" key={b.id}>
                            {b.image && <img src={b.image} alt="장면"/>}
                            {b.text && <small>{b.text}</small>}
                          </div>
                      );
                    }

                    const ch = characters[b.speaker] || {color: '#a68ee2'};

                    return (
                        <div className="log-entry" key={b.id}>
                          <div className="log-avatar">
                            {ch.image
                                ? <img src={ch.image} alt=""/>
                                : <span style={{color: ch.color}}>{(b.speaker || '?').slice(0, 1)}</span>}
                          </div>
                          <div className="log-body">
                            <strong style={{color: ch.color}}>{b.speaker || '미지정'}</strong>
                            <div className="log-bubble" style={{borderLeftColor: ch.color}}>{b.text}</div>
                          </div>
                        </div>
                    );
                  })}
                </div>
              </aside>
          )}
        </div>

        {showHelp && (
            <HelpModal activeTab={helpTab} setActiveTab={setHelpTab} onClose={() => setShowHelp(false)}/>
        )}

        {status && (
            <div className="toast" role="status" onClick={() => setStatus('')}>
              {status} <span>×</span>
            </div>
        )}
      </div>
  );
}

function safeName(value) {
  return (value || 'trpg-log').replace(/[\\/:*?"<>|]/g, '_').trim() || 'trpg-log';
}