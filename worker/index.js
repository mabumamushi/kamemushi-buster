import { page, style, app, font, music, hit } from './assets.js';

const DEFAULT_WORDS = [['apple','りんご'],['future','未来'],['robot','ロボット'],['planet','惑星'],['energy','エネルギー'],['light','光'],['dream','夢'],['signal','信号'],['forest','森'],['water','水'],['star','星'],['space','宇宙'],['bridge','橋'],['music','音楽'],['flower','花'],['ocean','海'],['window','窓'],['cloud','雲'],['friend','友達'],['morning','朝'],['silver','銀色'],['garden','庭'],['camera','カメラ'],['rocket','ロケット']];
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const error = (message,status=400) => json({error:message},status);
function parseCsv(source){
  const rows=[];let row=[],field='',quoted=false;
  source=source.replace(/^\uFEFF/,'');
  for(let i=0;i<source.length;i++){const c=source[i];
    if(c==='"'){if(quoted&&source[i+1]==='"'){field+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){row.push(field);field=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field=''}
    else field+=c;
  }
  if(quoted)throw Error('CSV の引用符が閉じていません');
  if(field||row.length){row.push(field);rows.push(row)}
  return rows;
}
async function words(env){
  if(!env.DB)return DEFAULT_WORDS.map(([english,japanese])=>({english,japanese}));
  const res=await env.DB.prepare('SELECT english, japanese FROM words ORDER BY id').all();
  return res.results?.length?res.results:DEFAULT_WORDS.map(([english,japanese])=>({english,japanese}));
}
async function handle(request,env){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/')return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}});
  if(request.method==='GET'&&path==='/style.css')return new Response(style,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'no-cache'}});
  if(request.method==='GET'&&path==='/app.js')return new Response(app,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-cache'}});
  if((request.method==='GET'||request.method==='HEAD')&&path==='/fonts/Makinas-4-Flat.otf'){
    const bytes=font();
    return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':'font/otf','content-length':String(bytes.byteLength),'cache-control':'public, max-age=31536000, immutable'}});
  }
  if((request.method==='GET'||request.method==='HEAD')&&(path==='/music/battle100.mp3'||path==='/music/hit.mp3')){
    const bytes=(path==='/music/hit.mp3'?hit:music)(),length=bytes.byteLength;
    const headers={'content-type':'audio/mpeg','accept-ranges':'bytes','cache-control':'public, max-age=3600'};
    const range=request.headers.get('range');
    if(range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${length}`}});
      const start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
      const end=match[1]?(match[2]?Math.min(Number(match[2]),length-1):length-1):length-1;
      if(start>=length||end<start)return new Response(null,{status:416,headers:{...headers,'content-range':`bytes */${length}`}});
      headers['content-range']=`bytes ${start}-${end}/${length}`;
      headers['content-length']=String(end-start+1);
      return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers});
    }
    headers['content-length']=String(length);
    return new Response(request.method==='HEAD'?null:bytes,{headers});
  }
  if(request.method==='GET'&&path==='/api/words')return json({words:await words(env)});
  if(request.method==='GET'&&path==='/api/ranking'){
    if(!env.DB)return json({scores:[]});
    const res=await env.DB.prepare('SELECT name, kills FROM scores ORDER BY kills DESC, created_at ASC LIMIT 20').all();
    return json({scores:res.results||[]});
  }
  if(request.method==='DELETE'&&path==='/api/ranking'){
    if(!env.ADMIN_KEY||request.headers.get('x-admin-key')!==env.ADMIN_KEY)return error('管理者キーが違います',403);
    if(!env.DB)return error('データベースが利用できません',503);
    const result=await env.DB.prepare('DELETE FROM scores').run();
    return json({count:result.meta?.changes||0});
  }
  if(request.method==='POST'&&path==='/api/start'){
    if(!env.DB)return error('ランキングは現在利用できません',503);
    const runId=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO runs (id, started_at, used) VALUES (?, ?, 0)').bind(runId,Date.now()).run();
    return json({runId});
  }
  if(request.method==='POST'&&path==='/api/result'){
    if(!env.DB)return error('ランキングは現在利用できません',503);
    let body;try{body=await request.json()}catch{return error('データが不正です')}
    const name=String(body.name||'').trim().slice(0,20),kills=Number(body.kills),runId=String(body.runId||'');
    if(!name||!Number.isInteger(kills)||kills<0||kills>300||!runId)return error('スコアが不正です');
    const run=await env.DB.prepare('SELECT started_at, used FROM runs WHERE id = ?').bind(runId).first();
    if(!run||run.used)return error('この記録は登録済みです');
    const elapsed=Date.now()-run.started_at;
    if(elapsed<55000||elapsed>150000)return error('プレイ時間が不正です');
    const update=await env.DB.prepare('UPDATE runs SET used = 1 WHERE id = ? AND used = 0').bind(runId).run();
    if(!update.meta?.changes)return error('この記録は登録済みです');
    await env.DB.prepare('INSERT INTO scores (name,kills,created_at) VALUES (?,?,?)').bind(name,kills,Date.now()).run();
    const rank=await env.DB.prepare('SELECT COUNT(*) + 1 AS rank FROM scores WHERE kills > ?').bind(kills).first();
    return json({rank:rank.rank});
  }
  if(request.method==='POST'&&path==='/api/import'){
    if(!env.ADMIN_KEY||request.headers.get('x-admin-key')!==env.ADMIN_KEY)return error('管理者キーが違います',403);
    if(!env.DB)return error('データベースが利用できません',503);
    const source=await request.text();if(source.length>200000)return error('CSV が大きすぎます');
    let rows;try{rows=parseCsv(source)}catch(e){return error(e.message)}
    const entries=rows.slice(1).map(r=>({english:(r[0]||'').trim(),japanese:(r[1]||'').trim()})).filter(r=>r.english&&r.japanese);
    if(!entries.length)return error('A2 以降の英語と B2 以降の日本語を確認してください');
    if(entries.length>1000)return error('最大 1000 語まで登録できます');
    if(entries.some(r=>r.english.length>100||r.japanese.length>100))return error('1つの単語は100文字以内にしてください');
    await env.DB.batch([env.DB.prepare('DELETE FROM words'),...entries.map(r=>env.DB.prepare('INSERT INTO words (english,japanese) VALUES (?,?)').bind(r.english,r.japanese))]);
    return json({count:entries.length});
  }
  return new Response('Not found',{status:404});
}
export default {async fetch(request,env){try{return await handle(request,env)}catch(e){console.error(e);return error('サーバーエラーが発生しました',500)}}};
