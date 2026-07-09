(function(){
  var STATE_NAMES={"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"Washington D.C."};
  var ord=function(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
  var el=document.getElementById('dd-map');
  if(!el||typeof d3==='undefined'||typeof topojson==='undefined'){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); return; }
  var focusState=el.getAttribute('data-focus-state')||'';
  var focusDistrict=el.getAttribute('data-focus-district')||'';
  var W=960,H=600;
  var wrap=el.parentNode;
  var back=document.getElementById('dd-map-back');
  var titleEl=document.getElementById('dd-map-title');
  var tip=document.getElementById('dd-map-tip');
  function init(){
  d3.json('/districts-map.topojson?v=1').then(function(topo){
    el.innerHTML='';
    var dcol=topojson.feature(topo,topo.objects.districts);
    var districts=dcol.features;
    var states=topojson.feature(topo,topo.objects.states).features;
    var proj=d3.geoAlbersUsa().fitSize([W,H],dcol);
    var path=d3.geoPath(proj);
    var svg=d3.select(el).append('svg').attr('viewBox','0 0 '+W+' '+H).attr('class','dd-map-svg').attr('role','img').attr('aria-label','Map of U.S. congressional districts');
    var g=svg.append('g');
    // Layers, bottom to top: districts, state borders, transparent state hit-targets.
    var districtsLayer=g.append('g');
    var bordersLayer=g.append('g');
    var hitLayer=g.append('g');
    var stateFeat={}; states.forEach(function(f){stateFeat[f.properties.st]=f;});
    var counts={}; districts.forEach(function(f){counts[f.properties.st]=(counts[f.properties.st]||0)+1;});
    var dSel=districtsLayer.selectAll('path.dd-d').data(districts).enter().append('path').attr('class','dd-d').attr('d',path)
      .classed('current',function(d){ return focusDistrict && d.properties.sd===focusDistrict; });
    bordersLayer.selectAll('path.dd-s').data(states).enter().append('path').attr('class','dd-s').attr('d',path);
    var hitSel=hitLayer.selectAll('path.dd-statehit').data(states).enter().append('path').attr('class','dd-statehit').attr('d',path);
    var selected=null;

    function labelFor(f){
      var st=f.properties.st, num=f.properties.sd.split('-')[1], name=STATE_NAMES[st]||st;
      return counts[st]===1 ? (name+' \u2014 At-large') : (name+' '+ord(parseInt(num,10))+' District');
    }
    function showTip(ev,text){ var r=el.getBoundingClientRect(); tip.textContent=text; tip.style.left=(ev.clientX-r.left)+'px'; tip.style.top=(ev.clientY-r.top)+'px'; tip.classList.add('show'); }
    function hideTip(){ tip.classList.remove('show'); }
    function setStateHot(st,on){ dSel.filter(function(d){return d.properties.st===st;}).classed('hot',on); }

    // Which layer receives pointer events depends on the mode: pick a state
    // first (hit layer), then pick a district within it (districts layer).
    function applyMode(){
      if(selected){
        dSel.classed('dim',function(d){return d.properties.st!==selected;})
            .classed('live',function(d){return d.properties.st===selected;});
        hitLayer.style('pointer-events','none');
        districtsLayer.style('pointer-events','all');
      } else {
        dSel.classed('dim',false).classed('live',false).classed('hot',false);
        hitLayer.style('pointer-events','all');
        districtsLayer.style('pointer-events','none');
      }
    }

    // National view: hover highlights a whole state, click zooms to it.
    hitSel.on('mousemove',function(ev,d){ showTip(ev, STATE_NAMES[d.properties.st]||d.properties.st); })
          .on('mouseenter',function(ev,d){ setStateHot(d.properties.st,true); })
          .on('mouseleave',function(ev,d){ setStateHot(d.properties.st,false); hideTip(); })
          .on('click',function(ev,d){ zoomToState(d.properties.st); });

    // State view: hover highlights one district, click opens its profile.
    dSel.on('mousemove',function(ev,d){ if(selected===d.properties.st) showTip(ev,labelFor(d)); })
        .on('mouseenter',function(ev,d){ if(selected===d.properties.st) d3.select(this).raise().classed('hot',true); })
        .on('mouseleave',function(ev,d){ d3.select(this).classed('hot',false); hideTip(); })
        .on('click',function(ev,d){ if(selected===d.properties.st && d.properties.sd!==focusDistrict) window.location.href='/district/'+d.properties.sd.toLowerCase()+'/'; });

    // Zoom/pan via d3.zoom; wheel disabled so the page still scrolls over the map.
    var zoom=d3.zoom().scaleExtent([1,40]).on('zoom',function(ev){ g.attr('transform',ev.transform); });
    svg.call(zoom).on('wheel.zoom',null).on('dblclick.zoom',null);

    function transformFor(b){
      var bw=b[1][0]-b[0][0], bh=b[1][1]-b[0][1], cx=(b[0][0]+b[1][0])/2, cy=(b[0][1]+b[1][1])/2;
      var k=Math.max(1, Math.min(40, 0.9*Math.min(W/bw, H/bh)));
      return d3.zoomIdentity.translate(W/2,H/2).scale(k).translate(-cx,-cy);
    }
    function zoomToState(st){
      selected=st; setStateHot(st,false); applyMode();
      back.classList.add('show'); titleEl.textContent=STATE_NAMES[st]||st; hideTip();
      svg.transition().duration(650).call(zoom.transform, transformFor(path.bounds(stateFeat[st])));
    }
    function fit(){
      selected=null; applyMode();
      back.classList.remove('show'); titleEl.textContent=''; hideTip();
      svg.transition().duration(650).call(zoom.transform, d3.zoomIdentity);
    }
    back.addEventListener('click',fit);
    el.addEventListener('mouseleave',hideTip);

    // Zoom buttons (reused from the game).
    Array.prototype.forEach.call(wrap.querySelectorAll('.mzb'),function(b){
      b.addEventListener('click',function(){
        var z=b.getAttribute('data-zoom');
        if(z==='in') svg.transition().duration(200).call(zoom.scaleBy,1.6);
        else if(z==='out') svg.transition().duration(200).call(zoom.scaleBy,1/1.6);
        else fit();
      });
    });

    applyMode();
    // On a district profile the map opens zoomed to that district's state.
    if(focusState && stateFeat[focusState]){ zoomToState(focusState); }
  }).catch(function(){ if(el&&el.parentNode)el.parentNode.classList.add('dd-map-failed'); });
  }
  // Only load geometry + render once the map is near the viewport (profile maps
  // sit below the fold); fires immediately when already in view (browse hub).
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){ if(es.some(function(e){return e.isIntersecting;})){ io.disconnect(); init(); } }, { rootMargin: '300px' });
    io.observe(el);
  } else { init(); }
})();