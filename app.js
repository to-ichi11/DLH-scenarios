(function bootstrap(){
"use strict";
const D=window.DLH_DATA;
if(!D || !D.events) { document.getElementById('content').textContent="シナリオデータを読み込めませんでした。";return; }
const NS="dlh-palme-v12-20261020";
const NAV=[["dashboard","進行状況"],["story","シナリオ"],["locations","ロケーション"],["events","イベント"],["clues","情報・フラグ"],["npcs","NPC関係"],["log","操作履歴"]];
const LOC_STATUS=["未公開","公開","訪問","完了"];
const EVT_STATUS=["未発生","進行中","完了","スキップ"];
const EMP=["好意","友好","中立","険悪","敵対"];
const PHASE=["導入","展開／機内","展開／王都","決戦","余韻"];
let view="dashboard",filter="",currentEvent=D.events[0].id,currentLocation="royal",currentNPC=D.npcs[0].id;
let session="default";
const htmlEscape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clip=s=>htmlEscape(s);
const root=document.getElementById("content"),nav=document.getElementById("nav"),sessionSelect=document.getElementById("sessionSelect");
function fresh(){return{version:1,title:"セッション1",phase:"導入",day:0,slot:"到着日・午後",retry:5,grit:3,places:Object.fromEntries(D.locations.map(p=>[p.id,p.initial?"公開":"未公開"])),events:{},eventChecks:{},clues:{},flags:Object.fromEntries(D.flags.map(f=>[f.id,f.initial])),npcs:{},notes:"",log:[],history:[]};}
function key(id){return NS+"-"+id}
function load(){try{let o=JSON.parse(localStorage.getItem(key(session)));return o&&o.version===1?Object.assign(fresh(),o):fresh()}catch(e){return fresh()}}
let S=load();
function sessions(){try{let a=JSON.parse(localStorage.getItem(NS+"-sessions"));return Array.isArray(a)&&a.length?a:[{id:"default",title:"セッション1"}]}catch(e){return [{id:"default",title:"セッション1"}]}}
function save(){try{localStorage.setItem(key(session),JSON.stringify(S))}catch(e){console.warn("保存に失敗",e)}}
function flash(msg){let f=document.getElementById("flash");f.innerHTML='<div class="note">'+clip(msg)+'</div>';setTimeout(()=>f.textContent="",2300)}
function change(action,update){let snap=typeof structuredClone==="function"?structuredClone(S):JSON.parse(JSON.stringify(S));delete snap.history;S.history=(S.history||[]).slice(-14);S.history.push(snap);update();S.log=(S.log||[]).slice(-199);S.log.push({at:new Date().toLocaleString("ja-JP"),action});save();render();}
function getFlag(id){return S.flags[id]||D.flags.find(x=>x.id===id)?.initial||""}
function statusEvt(id){return S.events[id]||"未発生"}
function loc(id){return D.locations.find(x=>x.id===id)}
function clue(id){return D.clues.find(x=>x.id===id)}
function event(id){return D.events.find(x=>x.id===id)}
function count(arr,fn){return arr.filter(fn).length}
function canStart(e){
 if(statusEvt(e.id)!=="未発生")return false;
 const status=e.location?S.places[e.location]:"未公開";
 const visited=["訪問","完了"].includes(status);
 const day=S.slot!=="夜";
 const previous={memory:"opening",departure:"memory",flight:"departure",guide:"flight",commander:"approach",escape:"commander",lettertruth:"escape",coup:"lettertruth"};
 if(e.id==="opening")return true;
 if(previous[e.id])return statusEvt(previous[e.id])==="完了";
 if(e.id==="approach")return S.phase==="決戦"||statusEvt("secret-visit")==="完了";
 if(e.id==="riot")return visited&&day&&getFlag("market")==="未発生";
 if(e.id==="oath")return visited&&day&&getFlag("ration")==="未発生";
 if(e.id==="port-witness")return visited&&day&&getFlag("witness")==="未遭遇";
 if(["port-medic","paper-print","clinic-query"].includes(e.id))return visited;
 if(e.id==="ambush")return S.slot==="夜"&&(getFlag("pursuit")==="尾行中"||getFlag("guideReport")!=="未報告");
 return Boolean(e.location)&&status!=="未公開"&&S.phase==="展開／王都";
}
function cue(e){return '<div class="smalltext muted">発生目安：'+clip(D.eventRules?.[e.id]||"GM判断")+'</div>';}

function pill(status){let cl=/完了|取得|保護|特定|訪問/.test(status)?"done":/未公開|未発生/.test(status)?"locked":/進行|公開|疑惑/.test(status)?"active":"warn";return '<span class="pill '+cl+'">'+clip(status)+'</span>'}
function title(hint,title,desc,extra=""){return '<div class="heading"><div><div class="eyebrow">'+clip(hint)+'</div><h1>'+clip(title)+'</h1><p>'+clip(desc)+'</p></div>'+extra+'</div>'}
function btn(name,action,value="",cls="btn"){return '<button class="'+cls+'" data-action="'+action+'" data-value="'+clip(value)+'">'+clip(name)+'</button>'}
function chip(name,kind,id){return '<button class="chip-link" data-action="open'+kind+'" data-value="'+clip(id)+'">'+clip(name)+'</button>'}
function select(options,value,action,id){return '<select aria-label="'+clip(id)+'" data-action="'+action+'" data-value="'+clip(id)+'">'+options.map(v=>'<option value="'+clip(v)+'"'+(value===v?' selected':'')+'>'+clip(v)+'</option>').join("")+'</select>'}
function stateSummary(){return '<div class="summary"><div class="metric"><small>現在のフェイズ</small><b style="font-size:17px">'+clip(S.phase)+'</b></div><div class="metric"><small>ロケーション訪問</small><b>'+count(D.locations,l=>["訪問","完了"].includes(S.places[l.id]))+' / '+D.locations.length+'</b></div><div class="metric"><small>イベント処理</small><b>'+count(D.events,e=>statusEvt(e.id)==="完了")+' / '+D.events.length+'</b></div><div class="metric"><small>取得した手掛かり</small><b>'+Object.values(S.clues).filter(Boolean).length+' / '+D.clues.length+'</b></div></div>'}
function flagsForNext(){let a=[];if(getFlag("warehouse")==="特定"&&S.phase==="展開／王都")a.push("監禁先を特定済み。PCが突入を宣言したら決戦フェイズへ。");if(getFlag("warehouse")==="未調査"&&S.phase==="決戦")a.push("緊急進行の場合、旧倉庫判明の経緯と警戒状態を記録。");if(getFlag("guide")==="拒否")a.push("ユダールを雇っていなくても初期3地点から探索可能。");if(getFlag("pursuit")==="尾行離脱")a.push("夜の襲撃者は無理に発生させない。");return a}
function renderDashboard(){
let next=flagsForNext();
root.innerHTML=title("MISSION CONTROL","セッション進行","進行・手掛かり・次に処理するシーンを一画面で確認")+stateSummary()+
'<div class="grid2"><div class="board"><h2>進行操作</h2><div class="control-row"><label class="control">フェイズ'+select(PHASE,S.phase,"setPhase","phase")+'</label><label class="control">日数 <input type="number" min="0" max="50" value="'+S.day+'" data-action="setDay"></label><label class="control">時間帯'+select(["到着日・午後","昼","夜"],S.slot,"setSlot","slot")+'</label></div><div class="control-row"><label class="control">リトライ <input type="number" value="'+S.retry+'" data-action="setNumber" data-value="retry"></label><label class="control">グリットプール <input type="number" value="'+S.grit+'" data-action="setNumber" data-value="grit"></label></div><div class="actions">'+btn("時間を進める","advanceTime")+btn("ひとつ戻す","undo")+'</div><div class="sep"></div><h3>重要な状態</h3>'+["warehouse","witness","guide","najib","alarm","fahri"].map(id=>{let f=D.flags.find(x=>x.id===id);return '<div class="control-row"><label class="control">'+clip(f.label)+select(f.options,getFlag(id),"setFlag",id)+'</label></div>'}).join("")+'</div>'+
'<div class="board"><h2>次に確認する項目</h2>'+(next.length?next.map(x=>'<div class="notice">'+clip(x)+'</div>').join(""):'<p class="muted">進行を妨げる必須警告はありません。未公開の場所もGM判断で公開できます。</p>')+'<h3>現在の調査候補</h3><div class="chips">'+D.locations.filter(l=>S.places[l.id]!=="未公開").map(l=>chip(l.name,"Loc",l.id)).join("")+'</div><div class="sep"></div><h3>直近の操作</h3>'+(S.log.length?S.log.slice(-6).reverse().map(x=>'<p class="smalltext"><span class="muted">'+clip(x.at)+'</span>　'+clip(x.action)+'</p>').join(""):'<p class="muted">まだ記録はありません。</p>')+'</div></div>'+
'<div class="board"><h2>シナリオ・サーキット</h2><div class="chips">'+PHASE.map(x=>btn(x,"setPhase",x,x===S.phase?"btn primary":"btn secondary")).join("")+'</div><p class="footer-note">導入 → 機内の刺客 → 王都自由探索 → 倉庫への突入・王国の剣 → 再会・政変。リトライ・グリットは原稿の暫定値を初期設定としています。</p></div>';
}
function eventTitle(e){let s=statusEvt(e.id);return '<div class="row wrap"><div><div class="eyebrow">'+clip(e.phase)+'</div><h3>'+clip(e.title)+'</h3></div>'+pill(s)+'</div>'}
function preview(s){return clip(s.replace(/\s+/g," ").slice(0,145))+"…"}
function renderStory(){
const e=event(currentEvent)||D.events[0];let status=statusEvt(e.id);const lines=e.text.split(/\n/).filter(x=>x.trim());
root.innerHTML=title("SCENARIO READER","シナリオ本文","v12.0から収録。進行記録と原稿の表示は独立しています。")+'<div class="grid2" style="grid-template-columns:minmax(235px,320px) minmax(0,1fr)"><div class="board"><input class="search" type="search" placeholder="イベント・本文を検索" data-action="filterStory" value="'+clip(filter)+'">'+D.events.filter(x=>!filter||(x.title+x.text).toLowerCase().includes(filter.toLowerCase())).map(x=>'<button class="nav-button '+(x.id===e.id?"active":"")+'" data-action="openEvent" data-value="'+clip(x.id)+'">'+clip(x.title)+' <small class="muted">｜'+clip(statusEvt(x.id))+'</small></button>').join("")+'</div><div class="board"><div class="row wrap"><h2>'+clip(e.title)+'</h2>'+pill(status)+(canStart(e)?pill("発生候補"):"")+'</div>'+cue(e)+'<div class="actions">'+EVT_STATUS.map(s=>btn(s,"setEvent",e.id+"::"+s,status===s?"btn primary":"btn")).join("")+'</div><div class="sep"></div><div class="reader" aria-label="シナリオ本文">'+lines.map(line=>'<div class="reader-line '+(/^(状況|解説・|エンドチェック|判定|GM処理|人物シーン|初回訪問)/.test(line)?"label":line.startsWith("□")?"check":/^(登場キャラクター|場所：|訪問：|夜間：)/.test(line)?"meta":"")+'">'+clip(line)+'</div>').join("")+'</div></div></div>';
}
function renderLocations(){
let l=loc(currentLocation)||D.locations[0];let e=D.events.find(x=>x.location===l.id);let st=S.places[l.id];
root.innerHTML=title("CITY EXPLORATION","王都ロケーション","公開 → 訪問 → 完了。訪問順や回数に強制制限はありません。")+'<div class="grid3">'+D.locations.map(x=>'<div class="item"><div class="row wrap"><h3>'+clip(x.name)+'</h3>'+pill(S.places[x.id])+'</div><p class="muted smalltext">'+clip(x.tag)+'</p><div class="actions">'+btn("詳細・操作","openLoc",x.id,"btn"+(x.id===l.id?" primary":""))+'</div></div>').join("")+'</div>'+
'<div class="board" style="margin-top:15px"><div class="row wrap"><h2>'+clip(l.name)+'</h2>'+pill(st)+'</div><p>'+clip(l.tag)+'</p><p class="muted smalltext">公開契機：'+clip(l.trigger)+'</p><h3>ロケーション状態</h3><div class="actions">'+LOC_STATUS.map(s=>btn(s,"setLoc",l.id+"::"+s,st===s?"btn primary":"btn")).join("")+'</div><div class="sep"></div><h3>次につながる場所</h3><div class="chips">'+l.links.map(id=>{let p=loc(id);return chip(p.name+" ["+S.places[id]+"]","Loc",id)}).join("")+'</div><div class="sep"></div><h3>関連NPC</h3><div class="chips">'+l.npcs.map(name=>{let n=D.npcs.find(x=>x.name===name||x.name.startsWith(name));return n?chip(n.name,"Npc",n.id):'<span class="pill">'+clip(name)+'</span>'}).join("")+'</div><div class="sep"></div><h3>関連イベント</h3>'+D.events.filter(x=>x.location===l.id).map(x=>'<div class="row wrap"><span>'+clip(x.title)+'</span><div>'+pill(statusEvt(x.id))+' '+btn("本文","openEvent",x.id,"tiny")+'</div></div>').join("")+'</div>';
}
function renderEvents(){
let groups=[["未発生","未着手"],["進行中","進行中"],["完了","完了"],["スキップ","不発生・省略"]];
root.innerHTML=title("EVENT BOARD","イベント管理","候補は発生目安。GMの判断で開始・完了・省略を切り替えます。")+'<div class="board"><h2>現在の発生候補　'+count(D.events,canStart)+'</h2><div class="grid3">'+D.events.filter(canStart).map(e=>'<div class="item"><strong>'+clip(e.title)+'</strong>'+cue(e)+'<div class="actions">'+btn("本文","openEvent",e.id,"tiny")+btn("開始","setEvent",e.id+"::進行中","tiny")+'</div></div>').join("")+'</div></div><div class="status-columns">'+groups.map(([st,label])=>'<div class="status-column"><h3>'+label+'　'+count(D.events,e=>statusEvt(e.id)===st)+'</h3>'+D.events.filter(e=>statusEvt(e.id)===st).map(e=>'<div class="item"><span class="eyebrow">'+clip(e.phase)+'</span><h3>'+clip(e.title)+'</h3>'+cue(e)+(canStart(e)?pill("候補"):"")+'<div class="actions">'+btn("本文","openEvent",e.id,"tiny")+(st!=="進行中"?btn("開始","setEvent",e.id+"::進行中","tiny"):"")+(st!=="完了"?btn("完了","setEvent",e.id+"::完了","tiny"):"")+(st!=="スキップ"?btn("省略","setEvent",e.id+"::スキップ","tiny"):"")+'</div></div>').join("")+'</div>').join("")+'</div><p class="footer-note">チャレンジの成否、実際の証言やNPCの反応は別途「情報・フラグ」へ記録してください。イベントを完了しても重要情報が無条件取得されることはありません。</p>';
}
function renderClues(){
root.innerHTML=title("INFORMATION & FLAGS","情報・フラグ","手掛かり取得と世界の状態を分けて記録。候補ロケーションは自動表示できます。")+'<div class="grid2"><div class="board"><h2>取得した情報　'+count(D.clues,c=>!!S.clues[c.id])+' / '+D.clues.length+'</h2>'+D.clues.map(c=>'<div class="item" style="margin:7px 0"><label class="checkbox-line"><input type="checkbox" data-action="toggleClue" data-value="'+c.id+'" '+(S.clues[c.id]?"checked":"")+'><span><strong>'+clip(c.title)+'</strong><br><span class="smalltext muted">'+clip(c.source)+'</span></span></label>'+ (S.clues[c.id]&&c.leads.length?'<div class="chips">'+c.leads.map(id=>chip(loc(id).name,"Loc",id)).join("")+'</div>':"")+'</div>').join("")+'</div><div class="board"><h2>状況フラグ</h2>'+D.flags.map(f=>'<div class="control-row"><label class="control">'+clip(f.label)+select(f.options,getFlag(f.id),"setFlag",f.id)+'</label></div>').join("")+'</div></div>';
}
function renderNpcs(){
let n=D.npcs.find(x=>x.id===currentNPC)||D.npcs[0];
root.innerHTML=title("EMPATHY","NPCとPC別エンパシー","段階は「好意 ＞ 友好 ＞ 中立 ＞ 険悪 ＞ 敵対」。各PCとの関係を個別に記録します。")+'<div class="board table-scroll"><table class="npc-matrix"><thead><tr><th>NPC</th><th>PC1</th><th>PC2</th><th>PC3</th><th>詳細</th></tr></thead><tbody>'+D.npcs.map(x=>'<tr><td>'+clip(x.name)+'</td>'+[1,2,3].map(p=>'<td>'+select(EMP,(S.npcs[x.id]?.["pc"+p])||"中立","setEmp",x.id+"::pc"+p)+'</td>').join("")+'<td>'+btn("開く","openNpc",x.id,"tiny")+'</td></tr>').join("")+'</tbody></table></div><div class="board"><h2>'+clip(n.name)+'</h2><div class="reader">'+n.details.split(/\n/).filter(Boolean).map(line=>'<div class="reader-line">'+clip(line)+'</div>').join("")+'</div><div class="control-row"><label class="control">GMメモ（'+clip(n.name)+'）<textarea data-action="setNpcNote" data-value="'+n.id+'">'+clip(S.npcs[n.id]?.note||"")+'</textarea></label></div></div>';
}
function renderLog(){
root.innerHTML=title("SESSION ARCHIVE","記録・バックアップ","JSONはPC情報を含むGM用セーブデータです。第三者と共有しないでください。")+'<div class="board"><h2>セッション名</h2><div class="control-row"><label class="control">名前<input data-action="setSessionTitle" value="'+clip(S.title)+'"></label></div><div class="actions">'+btn("JSON書き出し","export")+btn("JSON読み込み","import")+btn("直前の変更を戻す","undo")+btn("このセッションを初期化","reset","","btn danger")+'</div><div class="sep"></div><h2>セッションメモ</h2><label class="control"><textarea data-action="setNotes" rows="5">'+clip(S.notes||"")+'</textarea></label><div class="sep"></div><h2>変更履歴（最大200件）</h2>'+(S.log.length?S.log.slice().reverse().map(x=>'<p class="smalltext"><span class="muted">'+clip(x.at)+'</span>　'+clip(x.action)+'</p>').join(""):'<p class="muted">まだ変更はありません。</p>')+'</div><div class="notice warn">GitHub Pages上の進行データはサーバーに保存されません。ブラウザのデータを消去すると復元できません。定期的にJSONを書き出してください。</div>';
}
function render(){
nav.innerHTML=NAV.map(([id,text])=>'<button class="nav-button '+(id===view?"active":"")+'" data-action="nav" data-value="'+id+'">'+text+'</button>').join("");
const ss=sessions();sessionSelect.innerHTML=ss.map(x=>'<option value="'+clip(x.id)+'"'+(x.id===session?" selected":"")+'>'+clip(x.title)+'</option>').join("");
({dashboard:renderDashboard,story:renderStory,locations:renderLocations,events:renderEvents,clues:renderClues,npcs:renderNpcs,log:renderLog}[view]||renderDashboard)();
}
function navigate(tab){view=tab;filter="";render();window.scrollTo({top:0,behavior:"instant"})}
function exportJson(){let bytes=JSON.stringify({format:"DLH-PALME-SESSION",created:new Date().toISOString(),session:S},null,2);let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([bytes],{type:"application/json"}));a.download="砂漠の盟友_"+(S.title||"session").replace(/[\\/:*?"<>|]/g,"_")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);flash("JSONを書き出しました")}
function doAction(name,value,target){
 if(name==="nav"){navigate(value);return}
 if(name==="openEvent"){currentEvent=value;navigate("story");return}
 if(name==="openLoc"){currentLocation=value;navigate("locations");return}
 if(name==="openNpc"){currentNPC=value;navigate("npcs");return}
 if(name==="filterStory"){filter=target.value;const pos=target.selectionStart;renderStory();const input=root.querySelector('input[data-action="filterStory"]');if(input){input.focus();input.setSelectionRange(pos,pos)}return}
 if(name==="export"){exportJson();return}
 if(name==="import"){document.getElementById("importFile").click();return}
 if(name==="newSession"){const title=prompt("新しいセッション名","セッション"+(sessions().length+1));if(!title)return;let a=sessions();session="s"+Date.now();a.push({id:session,title:title.slice(0,70)});localStorage.setItem(NS+"-sessions",JSON.stringify(a));S=fresh();S.title=title.slice(0,70);save();render();return}
 if(name==="undo"){if(!S.history?.length){flash("戻せる操作がありません");return}let prev=S.history.pop(),hist=S.history;S=Object.assign(fresh(),prev,{history:hist});save();render();flash("変更を戻しました");return}
 if(name==="reset"){if(confirm("このセッションの進行記録をすべて初期化しますか？")){S=fresh();save();render()}return}
 if(name==="setPhase"){change("フェイズ → "+(target.value||value),()=>S.phase=target.value||value);return}
 if(name==="setDay"){change("探索日数 → "+target.value,()=>S.day=Math.max(0,Math.min(50,Number(target.value)||0)));return}
 if(name==="setSlot"){change("時間帯 → "+target.value,()=>S.slot=target.value);return}
 if(name==="advanceTime"){change("時間経過",()=>{if(S.slot==="到着日・午後"){S.day=1;S.slot="昼"}else if(S.slot==="昼")S.slot="夜";else{S.day+=1;S.slot="昼"}});return}
 if(name==="setNumber"){change(value+" → "+target.value,()=>S[value]=Number(target.value)||0);return}
 if(name==="setEvent"){let [id,st]=value.split("::");change(event(id).title+" → "+st,()=>S.events[id]=st);return}
 if(name==="setLoc"){let [id,st]=value.split("::");change(loc(id).name+" → "+st,()=>S.places[id]=st);return}
 if(name==="toggleClue"){change(clue(value).title+(target.checked?" 取得":" 解除"),()=>S.clues[value]=target.checked);return}
 if(name==="setFlag"){let f=D.flags.find(x=>x.id===value);change(f.label+" → "+target.value,()=>S.flags[value]=target.value);return}
 if(name==="setEmp"){let[id,pc]=value.split("::");change((D.npcs.find(x=>x.id===id)?.name||id)+" "+pc+" → "+target.value,()=>{S.npcs[id]??={};S.npcs[id][pc]=target.value});return}
 if(name==="setNpcNote"){S.npcs[value]??={};S.npcs[value].note=target.value;save();return}
 if(name==="setNotes"){S.notes=target.value;save();return}
 if(name==="setSessionTitle"){S.title=target.value;let a=sessions(),s=a.find(x=>x.id===session);if(s)s.title=S.title;localStorage.setItem(NS+"-sessions",JSON.stringify(a));save();render();return}
}
document.addEventListener("click",e=>{let t=e.target.closest("button[data-action]");if(t)doAction(t.dataset.action,t.dataset.value||"",t)});
document.addEventListener("change",e=>{let t=e.target;if(t.matches("select[data-action],input[data-action],textarea[data-action]"))doAction(t.dataset.action,t.dataset.value||"",t)});
document.addEventListener("input",e=>{let t=e.target;if(t.dataset.action==="filterStory"){doAction("filterStory","",t)}else if(["setNpcNote","setNotes"].includes(t.dataset.action))doAction(t.dataset.action,t.dataset.value||"",t)});
sessionSelect.addEventListener("change",()=>{session=sessionSelect.value;S=load();render();});
document.getElementById("importFile").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{let raw=JSON.parse(await file.text());if(raw.format!=="DLH-PALME-SESSION"||raw.session?.version!==1)throw Error("対応外の形式です");if(!confirm("現在の進行記録をインポート内容で上書きしますか？"))return;S=Object.assign(fresh(),raw.session);save();render();flash("復元しました")}catch(err){alert("読込失敗："+err.message)}finally{e.target.value=""}});
render();
})();