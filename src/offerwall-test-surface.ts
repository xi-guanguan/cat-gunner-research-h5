/** Explicit local replacement for an external SDK surface, not source artwork. */
export function createOfferWallTestSurface(actions:{close():void;claim():void;seed():void}){
 const root=document.createElement('section');root.id='cat-offerwall-local';root.setAttribute('role','dialog');root.setAttribute('aria-label','OfferWall 本地测试');
 Object.assign(root.style,{position:'fixed',inset:'0',zIndex:'130',background:'rgba(12,15,20,.96)',color:'#fff4d3',font:'16px system-ui',display:'none',boxSizing:'border-box',padding:'max(48px, env(safe-area-inset-top)) 20px 24px',overflow:'auto',touchAction:'pan-y'});
 const title=document.createElement('h2');title.textContent='OfferWall · 本地测试 provider';
 const description=document.createElement('p');description.textContent='原入口已接。这里代替外部 SDK 页面，不连接 Tapjoy，不执行真实任务，不代表线上收益。';
 const status=document.createElement('p');status.id='cat-offerwall-status';status.style.whiteSpace='pre-wrap';status.setAttribute('aria-live','polite');
 const buttons:HTMLButtonElement[]=[];
 for(const [id,text,run] of [['close','关闭并返回原页面',actions.close],['claim','检查并恢复待领取钻石',actions.claim],['seed','QA：注入 SDK 已赚余额 +17（非原奖励）',actions.seed]] as const){
  const b=document.createElement('button');b.id='cat-offerwall-'+id;b.textContent=text;Object.assign(b.style,{display:'block',width:'100%',maxWidth:'520px',minHeight:'48px',margin:'14px auto',font:'inherit'});b.addEventListener('click',run);root.appendChild(b);buttons.push(b);
 }
 root.prepend(title,description,status);for(const e of ['pointerdown','pointermove','pointerup','keydown','keyup'])root.addEventListener(e,event=>event.stopPropagation());document.body.appendChild(root);
 return {root,sync(s:{open:boolean;connected:boolean;contentReady:boolean;pending:boolean;balance:number;reserved:number;notice:string;qa:boolean}){
  root.style.display=s.open?'block':'none';status.textContent=`SDK：${s.connected?'本地连接':'未连接'} · 内容：${s.contentReady?'就绪':'未就绪'}\n本地已赚余额：${s.balance} · 待扣/待恢复：${s.reserved}\n${s.notice}`;
  buttons[1].disabled=s.pending;buttons[2].hidden=!s.qa;buttons[2].disabled=s.pending;
 }};
}
