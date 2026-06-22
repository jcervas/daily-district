/* ============================================================
   TILED GLOBE LOADER — canvas, no dependencies
   Small ~square tiles on an angled globe, no graticule. Fill is
   a screen-space diagonal anchored to a chosen corner, so the
   empty/active corner and the spin direction are independent.
   CMU palette by default.
   Options (constructor or data-*):
     size, tiles, speed, direction(cw|ccw), origin(corner),
     tilt, roll, empty(0..1), snap(0..1), scatter(0..0.5),
     gap(0..0.4), mode(solid|tartan), accent(hex)
   ============================================================ */
(function(){
  var TWO=Math.PI*2, D2R=Math.PI/180;
  var CARNEGIE_RED=[196,18,48];
  var THREADS=[[220,80,110],[196,18,48],[160,10,40],[130,5,25],[240,120,140]];
  var THREAD_PROB=0.2;
  var CORNERS={ 'top-right':[0.7071,-0.7071],'top-left':[-0.7071,-0.7071],
                'bottom-right':[0.7071,0.7071],'bottom-left':[-0.7071,0.7071] };

  function smooth01(x){ return x<=0?0 : x>=1?1 : x*x*(3-2*x); }
  function hexToRgb(h){ h=String(h).replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }

  function TiledGlobe(host, opts){
    this.canvas = host.tagName==='CANVAS' ? host : (function(){var c=document.createElement('canvas'); host.appendChild(c); return c;})();
    this.ctx=this.canvas.getContext('2d'); this.a=0; this._bn=null; this._bg=null;
    this.set(opts||{}, true);
    TiledGlobe._list.push(this);
  }
  TiledGlobe._list=[];

  TiledGlobe.prototype.set=function(o, force){
    o=o||{};
    if(!this.p){
      this.p=Object.assign({ size:120, tiles:100, speed:1, direction:'ccw', origin:'top-right',
        tilt:28, roll:22, empty:0.5, snap:0.7, scatter:0.18, gap:0.16, mode:'solid', accent:null }, o);
    } else { Object.assign(this.p, o); }
    var p=this.p;

    var dpr=Math.min(window.devicePixelRatio||1, 2);
    this.canvas.style.width=p.size+'px'; this.canvas.style.height=p.size+'px'; this.canvas.style.display='block';
    this.canvas.width=Math.round(p.size*dpr); this.canvas.height=Math.round(p.size*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);

    this.cx=p.size/2; this.cy=p.size/2; this.R=p.size/2 - Math.max(2,p.size*0.04);
    this.cosT=Math.cos(p.tilt*D2R); this.sinT=Math.sin(p.tilt*D2R);
    this.cosR=Math.cos(p.roll*D2R); this.sinR=Math.sin(p.roll*D2R);
    this.dir=p.direction==='cw'?-1:1;
    this.u=CORNERS[p.origin]||CORNERS['top-right'];
    this.thr=1.2 - p.empty*1.9;
    this.edgeW=0.03 + (1-p.snap)*0.45;
    this.scatter=p.scatter;
    this.baseColor=p.accent?hexToRgb(p.accent):CARNEGIE_RED;

    if(force || this._bn!==p.tiles || this._bg!==p.gap){
      this.build(); this._bn=p.tiles; this._bg=p.gap;
    } else {
      this.recolor();
    }
  };

  TiledGlobe.prototype.build=function(){
    var p=this.p, baseN=p.tiles%2?p.tiles+1:p.tiles, inset=1-p.gap, SEG=3;
    var latStep=360/baseN, edges=[], l,b,c,s;
    for(l=-90; l<89.999; l+=latStep) edges.push(l);
    edges.push(90);
    var tiles=[];
    for(b=0;b<edges.length-1;b++){
      var la0=edges[b], la1=edges[b+1], latc=(la0+la1)/2;
      var cols=Math.max(1,Math.round(baseN*Math.cos(latc*D2R))), lonStep=360/cols;
      for(c=0;c<cols;c++){
        var lo0=c*lonStep, lo1=lo0+lonStep, lonc=(lo0+lo1)/2, edge=[];
        for(s=0;s<=SEG;s++) edge.push([la1, lo0+(lo1-lo0)*s/SEG]);
        for(s=1;s<=SEG;s++) edge.push([la1+(la0-la1)*s/SEG, lo1]);
        for(s=1;s<=SEG;s++) edge.push([la0, lo1+(lo0-lo1)*s/SEG]);
        for(s=1;s<SEG;s++)  edge.push([la0+(la1-la0)*s/SEG, lo0]);
        for(s=0;s<edge.length;s++){
          edge[s]=[ (latc+(edge[s][0]-latc)*inset)*D2R, (lonc+(edge[s][1]-lonc)*inset)*D2R ];
        }
        tiles.push({ b:edge, latc:latc*D2R, lonc:lonc*D2R,
          rnd:Math.random()*2-1, cr:Math.random(), ci:Math.random(), color:null });
      }
    }
    this.tiles=tiles; this.recolor();
  };

  TiledGlobe.prototype.recolor=function(){
    var p=this.p, t, i;
    for(i=0;i<this.tiles.length;i++){
      t=this.tiles[i];
      t.color=(p.mode==='tartan' && t.cr<THREAD_PROB) ? THREADS[(t.ci*THREADS.length)|0] : this.baseColor;
    }
  };

  TiledGlobe.prototype.proj=function(lat, lon){
    var le=lon + this.dir*this.a, cl=Math.cos(lat);
    var X=cl*Math.cos(le), Y=Math.sin(lat), Z=cl*Math.sin(le);
    var Y2=Y*this.cosT - Z*this.sinT, Z2=Y*this.sinT + Z*this.cosT;
    var ox=X*this.R, oy=-Y2*this.R;
    return { sx:this.cx+ox*this.cosR-oy*this.sinR, sy:this.cy+ox*this.sinR+oy*this.cosR, z:Z2 };
  };

  TiledGlobe.prototype.render=function(){
    var ctx=this.ctx, tiles=this.tiles, ux=this.u[0], uy=this.u[1], i,k;
    ctx.clearRect(0,0,this.p.size,this.p.size);
    for(i=0;i<tiles.length;i++){
      var t=tiles[i], pc=this.proj(t.latc,t.lonc);
      if(pc.z<=0.02) continue;
      var q=((pc.sx-this.cx)*ux + (pc.sy-this.cy)*uy)/this.R;
      var level=smooth01((this.thr - (q + t.rnd*this.scatter))/this.edgeW);
      if(level<0.02) continue;
      var limb=smooth01(pc.z/0.18), shade=0.88+0.12*pc.z, col=t.color;
      var alpha=level*limb*0.92;
      var bnd=t.b, p0=this.proj(bnd[0][0],bnd[0][1]);
      ctx.beginPath(); ctx.moveTo(p0.sx,p0.sy);
      for(k=1;k<bnd.length;k++){ var pp=this.proj(bnd[k][0],bnd[k][1]); ctx.lineTo(pp.sx,pp.sy); }
      ctx.closePath();
      ctx.fillStyle='rgba('+Math.round(col[0]*shade)+','+Math.round(col[1]*shade)+','+Math.round(col[2]*shade)+','+alpha.toFixed(3)+')';
      ctx.fill();
    }
  };

  TiledGlobe.prototype.step=function(dt){ this.a=(this.a+0.55*this.p.speed*dt)%TWO; this.render(); };

  var last=performance.now();
  (function loop(now){
    var dt=Math.min((now-last)/1000,0.05); last=now;
    for(var i=0;i<TiledGlobe._list.length;i++) TiledGlobe._list[i].step(dt);
    requestAnimationFrame(loop);
  })(last);

  window.TiledGlobe=TiledGlobe;

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-globe]').forEach(function(el){
      var opts={};
      ['size','tiles','speed','direction','origin','tilt','roll','empty','snap','scatter','gap','mode','accent']
        .forEach(function(k){ if(el.dataset[k]!==undefined) opts[k]=isNaN(el.dataset[k])?el.dataset[k]:parseFloat(el.dataset[k]); });
      new TiledGlobe(el, opts);
    });
  });
})();
