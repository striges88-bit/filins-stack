from pathlib import Path
import json, html, re, math
from PIL import Image, ImageDraw, ImageFont
BASE=Path(__file__).resolve().parent
ASSETS=BASE
SOURCE=BASE/'components.json'
PIN='99aafe151a1be72be783e662858e8a0955add59f'
W,H=4000,4200
BG='#0b1220'; PANEL='#121e30'; BORDER='#293a51'; TEXT='#edf3fa'; MUTED='#a7b9cf'
BLUE='#6cbcff'; TEAL='#5be0ca'; AMBER='#ffc775'; PURPLE='#ba9bff'; RED='#ff9b9b'
FONT=Path('C:/Windows/Fonts')
im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><title>Caveman architecture and complete component inventory</title><rect width="100%" height="100%" fill="{BG}"/>']
text_bounds=[]
def text(x,y,s,size=24,color=TEXT,bold=False):
 f=ImageFont.truetype(str(FONT/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)
 b=d.textbbox((x,y),s,font=f); assert b[2]<W-20 and b[3]<H-15,(s,b)
 d.text((x,y),s,font=f,fill=color)
 svg.append(f'<text x="{x}" y="{y+size}" fill="{color}" font-family="Segoe UI,Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}">{html.escape(s)}</text>')
 text_bounds.append([s,list(b)])
def box(x,y,w,h,color=BORDER):
 d.rounded_rectangle((x,y,x+w,y+h),radius=18,fill=PANEL,outline=color,width=2)
 svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{PANEL}" stroke="{color}" stroke-width="2"/>')
def line(points,color=BLUE,dashed=False):
 for a,b in zip(points,points[1:]):
  if dashed:
   dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy)
   for i in range(0,int(length),20):
    j=min(i+10,length); d.line((a[0]+dx*i/length,a[1]+dy*i/length,a[0]+dx*j/length,a[1]+dy*j/length),fill=color,width=4)
  else:d.line([a,b],fill=color,width=4)
 a,b=points[-2:]; ang=math.atan2(b[1]-a[1],b[0]-a[0]); wing=[(b[0]-15*math.cos(ang+v),b[1]-15*math.sin(ang+v)) for v in [-.5,.5]]
 d.polygon([b,*wing],fill=color)
 svg.append(f'<polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="4"'+(' stroke-dasharray="10 10"' if dashed else '')+'/>')
 svg.append(f'<polygon points="'+ ' '.join(f'{x},{y}' for x,y in [b,*wing])+f'" fill="{color}"/>')
rows=json.loads(SOURCE.read_text(encoding='utf-8-sig'))
assert len(rows)==125
families={'Policy, skills and delegation':[], 'Host, CLI and routing':[], 'Engine and transformations':[], 'Tools, Browse and exact recovery':[], 'SDK and framework adapters':[], 'Accounting, Learn and contracts':[], 'Optional network and memory':[]}
for r in rows:
 i=r['id']
 if i.startswith('skill-') or i.startswith('cavecrew-') or i in ['response','core','delegate']:g='Policy, skills and delegation'
 elif i.startswith('compressor-') or i in ['engine','detector','compressors','toon','wasm','mode-record','mode-compress']:g='Engine and transformations'
 elif i.startswith('adapter-') or i.startswith('middleware') or i.startswith('sdk') or i in ['framework-adapters','pi-extension']:g='SDK and framework adapters'
 elif i in ['ccr','retrieve','engine-mcp','output-shrink','catalog-shrink','legacy-catalog-proxy','browser','chrome','browser-adapters','extension']:g='Tools, Browse and exact recovery'
 elif i in ['memory','memory-clients','cloud','cloud-control','managed-gateway','cloud-sync','telemetry','device-auth','pixel','mode-pixel']:g='Optional network and memory'
 elif i in ['usage-store','cache','stats','learn','learn-autopilot','contracts','provider-catalog','tracing','benchmarks','token-counter','mode-evaluation']:g='Accounting, Learn and contracts'
 else:g='Host, CLI and routing'
 families[g].append(r)
public=[]
for g,rr in families.items():
 for r in rr:
  assert f'/blob/{PIN}/' in r['source_url'],r['id']
  p={k:r[k] for k in ['id','name','layer','input','transform','output','connections','source_url','source_line']}
  p['visual_group']=g
  p['local_evidence']='Excluded locally' if r['id'] in ['memory','memory-clients','cloud','cloud-control','managed-gateway','cloud-sync','pixel','mode-pixel'] else 'Disabled locally' if r['id']=='telemetry' else 'Availability or configuration does not prove execution'
  public.append(p)
ASSETS.mkdir(parents=True,exist_ok=True)
(ASSETS/'components.json').write_text(json.dumps(public,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
text(70,42,'CAVEMAN',62,bold=True);text(455,65,'Architecture + complete component map',35,MUTED)
text(70,130,'Pinned upstream • 125 records • conditional paths • local evidence is separate from runtime proof',25,MUTED)
# The host owns tool execution and memory. Dashed edges require explicit configuration.
nodes={}; main_edges=[]
def node(i,x,y,w,h,title,notes,color=BLUE):
 nodes[i]=(x,y,w,h);box(x,y,w,h,color);text(x+24,y+18,title,29,color,True)
 for j,n in enumerate(notes):
  text(x+24,y+68+j*32,n,22,MUTED)
  assert text_bounds[-1][1][2] <= x+w-16,(i,n,'node text overflow')
def edge(source,target,points,label='',label_pos=None,color=BLUE,conditional=False):
 assert source in nodes and target in nodes
 line(points,color,conditional)
 if label and label_pos:text(*label_pos,label,18,color)
 main_edges.append({'source':source,'target':target,'condition':label or 'ordinary path','conditional':conditional,'points':points})
node('tools',70,280,650,200,'TOOLS + RAW OUTPUT',['Host executes tools under its approvals','Finite stdout, logs and tool results','Tool calls stay owned by the host','Catalog Shrink paths are distinct from output Shrink'])
node('output-shrink',850,280,650,200,'OUTPUT SHRINK',['Available finite command/log wrapper; optional','Overview + exact-original CCR handle','Retain original command exit status'],TEAL)
node('host',1630,280,650,200,'HOST / AGENT / CONTEXT',['Owns agent loop, approvals, tools and history','Native memory + Engram outside Caveman','Compact tool text is not exact evidence'])
node('proxy',2440,280,650,200,'LOCAL PROXY + ROUTING',['Configured local route; execution proof separate','Provider adapter and credential mapping','Local compression; external inference'])
node('providers',3250,280,650,200,'LLM / PROVIDER',['Receives inference content','Returns model result and tool intent','Host decides and executes tool calls'])
node('browser',70,700,650,220,'BROWSE + CHROME CDP',['Separate headless MCP available locally','Captures full accessibility tree','Actions and JavaScript can change site state'],TEAL)
node('ax',850,700,650,220,'AX COMPRESSOR',['Explicit accessibility-tree transform','Focus retains matches and ancestors','Actionable refs + recoverable raw AX'],TEAL)
node('ccr',1630,700,650,220,'CCR · AVAILABLE LOCALLY',['ccr_: bytes • ccr_obj_: typed objects','Native SQLite; WASM host persistence','Retrieve full source for exact conclusions','CCR is distinct from Cavemem'],TEAL)
node('engine',2440,700,650,220,'ENGINE: RECORD | COMPRESS',['Record forwards model-visible bytes unchanged','Compress: detect → transform → smaller + safe','Exact original stored before replacement','Failure or missing recovery → original'],TEAL)
node('pixel',3250,700,650,220,'PIXEL · EXCLUDED LOCALLY',['Optional text-to-image proxy transport','Explicit model allowlist + CCR','Not a third Engine mode'],AMBER)
node('policy',70,1120,650,220,'POLICY / SKILLS / CAVECREW',['Response voice • Core • specialist skills','Hooks and native plugins deliver policy','Opt-in bounded subagent contracts','Presence does not prove event delivery'],PURPLE)
node('learn',850,1120,650,220,'LEARN + STATS',['Consent-gated scan → observations / report','Autopilot is event-driven and throttled','Local excluded memory: --no-remember','Stats reads proxy usage; savings unknown'],TEAL)
node('memory',1630,1120,650,220,'CAVEMEM · EXCLUDED LOCALLY',['Optional memory recall and writes','Separate memory clients and storage','No local adoption; not CCR'],AMBER)
node('middleware',2440,1120,650,220,'SDK + MIDDLEWARE',['Receives copied outbound request from host','Framework keeps history and inference ownership','Recovery-bound executor gates compression','Installed locally; project integration unproven'],TEAL)
node('managed-gateway',3250,1120,650,220,'CLOUD GATEWAY · EXCLUDED',['Optional hosted inference content path','Selected route still reaches a model provider','Separate from Cloud metadata/control'],AMBER)
node('native-runtime',70,1500,650,220,'NATIVE HOOK BACKEND',['CLI / profiles / lifecycle event adapters','Task and typed working-memory runtime','Supported host plugin controls','Separate from proxy compression'],PURPLE)
node('history',850,1500,650,220,'SUPPORTED HISTORY + USAGE',['Consent-gated local history input','Learn report, SQLite observations and state','Proxy usage / cache hints → local stats','No user history scanned for this diagram'],TEAL)
node('middleware-store',2440,1500,650,220,'SCOPED MIDDLEWARE STORE',['cmw_: scoped originals and plans','Principal / namespace / session / branch / epoch','Retention / deletion / optional encryption','Separate protocol from local CCR'],TEAL)
node('cloud-control',3250,1500,650,220,'CLOUD CONTROL · EXCLUDED',['Device auth + project-scoped control / read MCP','Authenticated metadata sync omits raw bodies','Control is separate from hosted inference','CLI telemetry separately disabled locally'],AMBER)
edge('tools','output-shrink',[(720,380),(850,380)],'optional',(735,340),TEAL,True)
edge('output-shrink','host',[(1500,380),(1630,380)],'overview',(1515,340),TEAL,True)
edge('host','proxy',[(2280,380),(2440,380)],'configured route',(2300,340),BLUE,True)
edge('proxy','providers',[(3090,380),(3250,380)],'provider API',(3100,340))
edge('tools','host',[(400,280),(400,230),(1780,230),(1780,280)],'exact-output bypass',(900,194),BLUE)
edge('providers','host',[(3600,280),(3600,180),(2180,180),(2180,280)],'model result to host',(2500,145),BLUE)
edge('host','tools',[(1955,480),(1955,550),(400,550),(400,480)],'host executes tool calls',(740,512),AMBER)
edge('browser','ax',[(720,800),(850,800)],'raw AX',(740,760),TEAL)
edge('ax','ccr',[(1500,800),(1630,800)],'store raw',(1515,760),TEAL)
edge('ccr','host',[(1955,700),(1955,550),(2150,550),(2150,480)],'refs / retrieve',(1965,610),TEAL)
edge('output-shrink','ccr',[(1200,480),(1200,620),(1760,620),(1760,700)],'retain original',(1230,580),TEAL,True)
edge('proxy','engine',[(2680,480),(2680,700)],'eligible input',(2480,580),TEAL,True)
edge('engine','proxy',[(2890,700),(2890,480)],'safe replacement',(2910,580),TEAL,True)
edge('engine','ccr',[(2440,820),(2280,820)],'store / recover',(1740,945),TEAL)
edge('engine','pixel',[(3090,800),(3250,800)],'allowlisted',(3100,760),AMBER,True)
edge('pixel','providers',[(3580,700),(3580,480)],'optional transport',(3600,580),AMBER,True)
edge('host','middleware',[(2280,430),(2360,430),(2360,1000),(2640,1000),(2640,1120)],'copied outbound request',(2448,960),TEAL,True)
edge('middleware','engine',[(2920,1120),(2920,1035),(3010,1035),(3010,920)],'executor-bound',(2940,985),TEAL,True)
edge('middleware','middleware-store',[(2770,1340),(2770,1500)],'scoped recovery',(2790,1400),TEAL,True)
edge('middleware','providers',[(3090,1210),(3170,1210),(3170,580),(3380,580),(3380,480)],'direct SDK inference',(3210,530),BLUE,True)
edge('proxy','managed-gateway',[(3090,430),(3130,430),(3130,1000),(3470,1000),(3470,1120)],'selected hosted route',(3220,960),AMBER,True)
edge('managed-gateway','providers',[(3900,1210),(3950,1210),(3950,380),(3900,380)],color=AMBER,conditional=True)
edge('cloud-control','managed-gateway',[(3570,1500),(3570,1340)],'auth / control',(3600,1400),AMBER,True)
edge('history','cloud-control',[(1500,1630),(1570,1630),(1570,1780),(3590,1780),(3590,1720)],'metadata-only sync when authorized',(1770,1740),AMBER,True)
edge('memory','host',[(2280,1230),(2320,1230),(2320,500),(2230,500),(2230,480)],'recall / write',(2125,1020),AMBER,True)
edge('host','memory',[(2230,480),(2230,500),(2320,500),(2320,1230),(2280,1230)],'optional memory write',color=AMBER,conditional=True)
edge('policy','host',[(720,1200),(770,1200),(770,590),(1700,590),(1700,480)],'selected policy delivery',(810,552),PURPLE,True)
edge('native-runtime','policy',[(400,1500),(400,1340)],'supported events',(420,1400),PURPLE,True)
edge('history','learn',[(1200,1500),(1200,1340)],'consented scan',(970,1400),TEAL,True)
edge('learn','history',[(1390,1340),(1390,1500)],'reports / state',(1230,1355),TEAL,True)
edge('proxy','history',[(2440,450),(2400,450),(2400,1450),(1500,1450),(1500,1500)],'usage / cache observations',(1760,1415),TEAL,True)
text(70,1815,'Blue: inference / host loop     Teal: compression / recovery     Purple: policy / events     Amber: tools / excluded options',26,MUTED)
text(70,1860,'Dashed = explicitly selected or conditional. Configured / available ≠ activated. Excluded badges describe local policy.',25,MUTED)
text(70,1910,'COMPLETE INVENTORY',35,bold=True);text(600,1920,'125 exact source names below. This map draws selected important edges, not all 207 inventory relations.',24,MUTED)
placements=[(70,1990,1240),(1380,1990,1240),(2690,1990,1240),(70,2970,1240),(1380,2970,1240),(2690,2970,1240)]
sets=[['Policy, skills and delegation'],['Host, CLI and routing','Accounting, Learn and contracts'],['SDK and framework adapters'],['Engine and transformations'],['Tools, Browse and exact recovery'],['Optional network and memory']]
coverage={}
for (x,y,w),groups in zip(placements,sets):
 count=sum(len(families[g]) for g in groups);height=960 if y==1990 else 900
 box(x,y,w,height)
 yy=y+22
 for g in groups:
  text(x+22,yy,g,25,TEAL if g!='Optional network and memory' else AMBER,True);yy+=42
  for r in families[g]:
   label=r['name']
   text(x+26,yy,'• '+label,22)
   coverage[r['id']]={'group':g,'label':label,'panel':[x,y,w,height],'label_position':[x+26,yy]}
   yy+=27
  yy+=20
 assert yy<y+height,(groups,yy,y+height)
text(70,4090,'SOURCE: JuliusBrussee/caveman @ '+PIN+' • Public documentation only. No runtime activation or savings claim.',23,MUTED)
svg.append('</svg>')
(ASSETS/'architecture.svg').write_text('\n'.join(svg),encoding='utf-8')
im.save(ASSETS/'architecture.png',optimize=True)
assert set(coverage)=={r['id'] for r in rows}
assert all(c['target'] in coverage for r in rows for c in r['connections'])
# An edge may meet its endpoint border, but must not pass through any box interior.
for e in main_edges:
 for a,b in zip(e['points'],e['points'][1:]):
  assert a[0]==b[0] or a[1]==b[1]
  for nid,(x,y,w,h) in nodes.items():
   crosses=(a[0]==b[0] and x<a[0]<x+w and max(min(a[1],b[1]),y)<min(max(a[1],b[1]),y+h)) or (a[1]==b[1] and y<a[1]<y+h and max(min(a[0],b[0]),x)<min(max(a[0],b[0]),x+w))
   assert not crosses,(e['source'],e['target'],nid,'route crosses box')
serialized=json.dumps(public)
assert not re.search(r'C:[/\\]|session[_-]?id|api[_-]?key\s*[=:]',serialized,re.I)
proof={'dimensions':[W,H],'records':len(rows),'visible_labels':len(coverage),'missing_ids':[],'duplicate_ids':len(rows)-len(coverage),'conditional_inventory_edges':sum(len(r['connections']) for r in rows),'all_inventory_endpoints_exist':True,'all_sources_pinned':True,'public_path_scan':'PASS','coverage':coverage,'diagram_nodes':list(nodes),'main_map_edges':main_edges,'main_map_edge_count':len(main_edges),'main_map_box_crossings':0,'all_main_map_endpoints_exist':all(e['source'] in nodes and e['target'] in nodes for e in main_edges),'notes':['Local status is supplied-profile evidence, not fresh execution.','Renderer uses Windows Segoe UI fonts and bundled Pillow.','SVG and PNG share primitive layout and content, with font baseline differences.']}
(BASE/'coverage.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8')
viewer='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caveman architecture</title><style>body{margin:0;background:#0b1220;color:#edf3fa;font:16px system-ui}header{position:sticky;top:0;background:#121e30;padding:14px 24px;display:flex;gap:24px;align-items:center}button,a{color:#6cbcff;background:transparent;border:1px solid #293a51;border-radius:6px;padding:8px;text-decoration:none}main{padding:18px}svg{width:100%;height:auto}body.zoom svg{width:4000px}p{margin:0;color:#a7b9cf}</style><header><strong>Caveman architecture</strong><button onclick="document.body.classList.toggle('zoom')">Fit / full size</button><a href="architecture.svg" download>SVG</a><a href="architecture.png" download>PNG</a><p>125 source-backed records. Configuration does not prove execution.</p></header><main>'''+ '\n'.join(svg)+ '</main></html>'
(ASSETS/'viewer.html').write_text(viewer,encoding='utf-8')
print(json.dumps({k:proof[k] for k in ['dimensions','records','visible_labels','conditional_inventory_edges','all_sources_pinned','public_path_scan']}))
