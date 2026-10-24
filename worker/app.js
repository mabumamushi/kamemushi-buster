(function(){
  const $ = (s) => document.querySelector(s);
  const panels = ['intro','game','result','ranking','admin'];
  const bugMarkup = $('.hero-bug .bug').outerHTML;
  const readSetting=key=>{try{return localStorage.getItem(key)!=='off'}catch{return true}};
  const saveSetting=(key,on)=>{try{localStorage.setItem(key,on?'on':'off')}catch{}};
  const state = {name:'',level:3,words:[],seen:[],current:null,kills:0,runId:null,active:false,battleReady:false,pending:false,loading:false,deadline:0,tick:null,returnPanel:'intro',sound:readSetting('kb-sfx'),bgm:readSetting('kb-bgm')};
  const bgmAudio=$('#bgm');bgmAudio.volume=.36;
  const hitAudio=$('#hitSound');hitAudio.volume=.78;
  function playHit(){if(!state.sound)return;try{hitAudio.currentTime=0;hitAudio.play().catch(()=>{})}catch{}}
  function primeMusic(){if(!state.bgm)return;bgmAudio.muted=true;bgmAudio.play().catch(()=>{})}
  function startMusic(reset){if(!state.bgm)return;if(reset)try{bgmAudio.currentTime=0}catch{};bgmAudio.muted=false;bgmAudio.play().catch(()=>{})}
  function stopMusic(reset){bgmAudio.pause();bgmAudio.muted=false;if(reset)try{bgmAudio.currentTime=0}catch{}}
  function syncSoundControls(){
    for(const [id,on] of [['sfxToggle',state.sound],['bgmToggle',state.bgm]]){const button=$('#'+id);button.setAttribute('aria-checked',String(on));button.querySelector('.switch-status').textContent=on?'ON':'OFF'}
    $('#soundBtn').textContent=state.sound||state.bgm?'◖))':'◖';
  }
  syncSoundControls();
  function show(id){panels.forEach(p => $('#'+p).classList.toggle('active',p===id));window.scrollTo(0,0)}
  function toast(message,bad){const el=$('#feedback');el.textContent=message;el.classList.toggle('bad',!!bad);clearTimeout(el._t);el._t=setTimeout(()=>el.textContent='',700)}
  function play(freq,duration,type){if(!state.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;const c=play.c||(play.c=new C());const o=c.createOscillator(),g=c.createGain();o.type=type||'sawtooth';o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq/3),c.currentTime+duration);g.gain.setValueAtTime(.055,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+duration)}catch{}}
  function bug(word){
    const green=Math.random()<.2;
    const el=$('#enemy');
    el.className='enemy enter';
    el.innerHTML=bugMarkup;
    const shape=el.querySelector('.bug');
    shape.classList.toggle('green',green);
    shape.classList.toggle('brown',!green);
    shape.querySelector('.bug-core span').textContent=word.japanese;
    el.dataset.color=green?'#a4f36a':'#cda176';
    state.current=word;
    setTimeout(()=>el.classList.remove('enter'),850);
  }
  function nextWord(){
    if(!state.active)return;
    const pool=state.words.filter(w=>!state.seen.includes(w));
    if(!pool.length)state.seen=[];
    const available=pool.length?pool:state.words;
    const word=available[Math.floor(Math.random()*available.length)];
    state.seen.push(word);
    bug(word);
    $('#answerInput').value='';
    $('#answerInput').focus();
    state.pending=false;
  }
  function burst(){
    const rect=$('#enemy').getBoundingClientRect(),arena=$('#arena').getBoundingClientRect(),box=$('#particles');
    box.replaceChildren();
    for(let i=0;i<52;i++){
      const e=document.createElement('i');
      e.className='particle';
      const x=rect.left-arena.left+rect.width*(.18+Math.random()*.64),y=rect.top-arena.top+rect.height*(.16+Math.random()*.68);
      e.style.left=x+'px';e.style.top=y+'px';e.style.setProperty('--s',(3+Math.random()*9)+'px');
      e.style.setProperty('--c',Math.random()<.2?'#e8fbea':$('#enemy').dataset.color);
      e.style.setProperty('--dx',((Math.random()-.5)*340)+'px');e.style.setProperty('--dy',((Math.random()-.5)*270)+'px');
      e.style.setProperty('--rot',((Math.random()-.5)*800)+'deg');box.append(e);
    }
    setTimeout(()=>box.replaceChildren(),600);
  }
  function updateHud(){
    $('#score').innerHTML=state.kills+'<span>匹</span>';
    const left=Math.max(0,state.deadline-performance.now());
    $('#timer').innerHTML=String(Math.ceil(left/1000)).padStart(2,'0')+'<span>s</span>';
    $('#timeFill').style.width=(left/60000*100)+'%';
    if(left<=0)finish();
  }
  async function begin(){
    if(state.loading)return;
    const name=$('#playerName').value.trim();
    if(!name){$('#nameError').textContent='名前を入力してください';$('#playerName').focus();return}
    $('#nameError').textContent='';
    const level=Number($('#playerLevel').value);
    state.loading=true;$('#startBtn').disabled=true;
    let words;
    try{
      const r=await fetch('/api/words?level='+level),data=await r.json();
      if(!r.ok)throw Error(data.error||'問題を読み込めませんでした');
      words=data.words;
      if(!Array.isArray(words)||!words.length)throw Error('Level '+level+' の問題は未登録です');
    }catch(e){$('#nameError').textContent=e.message||'問題を読み込めませんでした';return}
    finally{state.loading=false;$('#startBtn').disabled=false}
    state.name=name;state.level=level;state.words=words;state.kills=0;state.seen=[];state.runId=null;state.active=false;state.battleReady=false;state.pending=false;
    primeMusic();
    $('#hudName').textContent=name;$('#score').innerHTML='0<span>匹</span>';$('#timer').innerHTML='60<span>s</span>';$('#timeFill').style.width='100%';
    $('#enemy').innerHTML='';$('#answerInput').disabled=true;show('game');
    for(const n of ['3','2','1']){if(!$('#game').classList.contains('active')){stopMusic(true);return}$('#countdown').textContent=n;play(400,.1,'sine');await new Promise(res=>setTimeout(res,750))}
    $('#countdown').textContent='';
    try{const r=await fetch('/api/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({level})});if(r.ok){const data=await r.json();state.runId=data.runId}}catch{}
    if(!$('#game').classList.contains('active')){stopMusic(true);return}
    state.active=true;nextWord();
    await new Promise(res=>setTimeout(res,850));
    if(!$('#game').classList.contains('active')){state.active=false;stopMusic(true);return}
    state.battleReady=true;startMusic(true);
    $('#answerInput').disabled=false;$('#answerInput').focus();state.deadline=performance.now()+60000;state.tick=setInterval(updateHud,100);updateHud();
  }
  function finish(){
    if(!state.active)return;
    state.active=false;state.battleReady=false;state.pending=false;clearInterval(state.tick);
    stopMusic(true);
    $('#answerInput').disabled=true;$('#countdown').textContent='';
    $('#finalScore').innerHTML=state.kills+'<span>匹</span>';$('#resultName').textContent=state.name;
    $('#personalRank').textContent='スコアを保存中…';
    $('#wordList').classList.add('hidden');show('result');play(580,.4,'triangle');
    const payload={runId:state.runId,name:state.name,kills:state.kills};
    fetch('/api/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'保存できませんでした');$('#personalRank').textContent=d.rank?'LEVEL '+state.level+' RANK  #'+d.rank:'スコアを保存しました'}).catch(()=>{$('#personalRank').textContent='スコアを保存できませんでした'});
  }
  $('#answerForm').addEventListener('submit',e=>{
    e.preventDefault();if(!state.active||!state.battleReady||state.pending||!state.current)return;
    const answer=$('#answerInput').value.trim().toLowerCase().replace(/\s+/g,' ');
    const expected=state.current.english.trim().toLowerCase().replace(/\s+/g,' ');
    if(answer===expected){
      state.pending=true;state.kills++;$('#score').innerHTML=state.kills+'<span>匹</span>';
      burst();$('#enemy').classList.add('shatter');toast('');playHit();
      setTimeout(nextWord,500);
    }else{
      $('#enemy').classList.remove('wrong');void $('#enemy').offsetWidth;$('#enemy').classList.add('wrong');
      const game=$('#game');game.classList.remove('shake');void game.offsetWidth;game.classList.add('shake');
      toast('');play(190,.22,'square');$('#answerInput').select();
      setTimeout(()=>$('#enemy').classList.remove('wrong'),420);
      clearTimeout(game._shakeTimer);game._shakeTimer=setTimeout(()=>game.classList.remove('shake'),360);
    }
  });
  $('#startBtn').addEventListener('click',begin);
  $('#replayBtn').addEventListener('click',()=>{show('intro');$('#playerName').focus()});
  $('#wordsBtn').addEventListener('click',()=>{
    const wrap=$('#wordList');wrap.classList.toggle('hidden');const rows=$('#wordRows');rows.replaceChildren();
    state.words.forEach(w=>{const row=document.createElement('div');row.className='word-row';const a=document.createElement('span'),b=document.createElement('span');a.textContent=w.japanese;b.textContent=w.english;row.append(a,b);rows.append(row)});
  });
  async function loadRanking(){
    const level=$('#rankingLevel').value;
    $('#rankingRows').textContent='読み込み中…';
    try{const r=await fetch('/api/ranking?level='+level);const data=await r.json();if(!r.ok)throw Error(data.error||'読み込めませんでした');if($('#rankingLevel').value!==level)return;const wrap=$('#rankingRows');wrap.replaceChildren();
      if(!data.scores.length){wrap.textContent='まだ記録がありません';return}
      data.scores.forEach((s,i)=>{const row=document.createElement('div');row.className='rank-row';const n=document.createElement('span'),name=document.createElement('strong'),kills=document.createElement('span');n.className='num';n.textContent=String(i+1).padStart(2,'0');name.textContent=s.name;kills.className='kills';kills.textContent=s.kills+'匹';row.append(n,name,kills);wrap.append(row)});
    }catch{$('#rankingRows').textContent='読み込めませんでした'}
  }
  function ranking(){state.returnPanel=$('.panel.active')?.id||'intro';$('#rankingLevel').value=$('#playerLevel').value;show('ranking');loadRanking()}
  $('#rankBtn').addEventListener('click',ranking);
  $('#rankingLevel').addEventListener('change',loadRanking);
  let clearRankingArmedLevel=null;
  function resetClearRanking(){clearRankingArmedLevel=null;$('#clearRankingBtn').textContent='Level '+$('#clearRankingLevel').value+' を削除'}
  $('#clearRankingLevel').addEventListener('change',()=>{resetClearRanking();$('#clearRankingStatus').textContent='' });
  $('#adminBtn').addEventListener('click',()=>{state.returnPanel=$('.panel.active')?.id||'intro';show('admin');$('#adminKey').value=sessionStorage.getItem('kb-admin-key')||'';resetClearRanking();$('#clearRankingStatus').textContent=''});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>show(state.returnPanel)));
  $('#soundBtn').addEventListener('click',()=>{const menu=$('#soundMenu');menu.hidden=!menu.hidden;$('#soundBtn').setAttribute('aria-expanded',String(!menu.hidden))});
  $('#sfxToggle').addEventListener('click',()=>{state.sound=!state.sound;saveSetting('kb-sfx',state.sound);syncSoundControls()});
  $('#bgmToggle').addEventListener('click',()=>{state.bgm=!state.bgm;saveSetting('kb-bgm',state.bgm);if(state.bgm&&state.battleReady)startMusic(false);else if(state.bgm&&$('#game').classList.contains('active'))primeMusic();else if(!state.bgm)stopMusic(false);syncSoundControls()});
  document.addEventListener('click',e=>{if(!e.target.closest('.sound-control')){$('#soundMenu').hidden=true;$('#soundBtn').setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#soundMenu').hidden=true;$('#soundBtn').setAttribute('aria-expanded','false')}});
  $('#importBtn').addEventListener('click',async()=>{
    const file=$('#csvFile').files[0],key=$('#adminKey').value.trim(),level=$('#csvLevel').value,status=$('#importStatus');
    if(!key||!file){status.textContent='管理者キーと CSV ファイルを指定してください';return}
    status.textContent='読み込み中…';sessionStorage.setItem('kb-admin-key',key);
    try{const csv=await file.text();const r=await fetch('/api/import?level='+level,{method:'POST',headers:{'content-type':'text/csv;charset=utf-8','x-admin-key':key},body:csv});const d=await r.json();if(!r.ok)throw Error(d.error||'読み込み失敗');status.textContent='Level '+level+' に '+d.count+' 語を登録しました'}catch(e){status.textContent=e.message}
  });
  $('#clearRankingBtn').addEventListener('click',async()=>{
    const key=$('#adminKey').value.trim(),level=$('#clearRankingLevel').value,status=$('#clearRankingStatus'),button=$('#clearRankingBtn');
    if(!key){status.textContent='管理者キーを入力してください';return}
    if(clearRankingArmedLevel!==level){clearRankingArmedLevel=level;button.textContent='もう一度押して Level '+level+' を削除';status.textContent='Level '+level+' のランキング記録を削除します';return}
    button.disabled=true;status.textContent='削除中…';sessionStorage.setItem('kb-admin-key',key);
    try{const r=await fetch('/api/ranking?level='+level,{method:'DELETE',headers:{'x-admin-key':key}});const d=await r.json();if(!r.ok)throw Error(d.error||'削除失敗');status.textContent='Level '+level+' の '+d.count+' 件を削除しました';resetClearRanking()}
    catch(e){status.textContent=e.message;resetClearRanking()}
    finally{button.disabled=false}
  });
})();
