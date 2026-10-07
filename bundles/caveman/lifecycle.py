import argparse,hashlib,json,os,re,shutil,sys,tempfile,tomllib
from pathlib import Path
if sys.flags.optimize: raise SystemExit('Assertions require non-optimized Python.')
B=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def load(p): return json.loads(Path(p).read_text('utf-8-sig'))
def dump(p,v): Path(p).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n','utf-8')
def stage(destination,home):
 destination=Path(destination); home=Path(home); lock=load(B/'provenance-lock.json')
 for item in lock['maintained_cli_files']+lock['launchers']+[f for c in lock['optional']['components'] for f in c['files']]:assert sha((B/item['path']).read_bytes())==item['sha256'],'Reviewed source drift'
 if destination.exists():
  verify_release(destination)
  for source in [q for q in (B/'cli').rglob('*') if q.is_file()]+[B/'native-hook.ps1',B/'caveman.ps1']+[q for q in (B/'optional').rglob('*') if q.is_file()]:
   target=destination/('cli/'+str(source.relative_to(B)).replace('\\','/') if source.is_relative_to(B/'optional') else source.relative_to(B))
   assert target.read_bytes()==source.read_bytes(),'Existing release differs from reviewed source'
  print('PASS existing release matches reviewed source');return
 destination.mkdir(parents=True)
 for name in ['cli','licenses']: shutil.copytree(B/name,destination/name)
 shutil.copytree(B/'optional',destination/'cli/optional')
 for name in ['native-hook.ps1','caveman.ps1']: shutil.copyfile(B/name,destination/name)
 binaries={}
 for item in lock['binaries']:
  src=home/'.caveman'/item['path']; data=src.read_bytes(); assert sha(data)==item['sha256'],'Binary drift'
  target=destination/item['path']; target.parent.mkdir(exist_ok=True); target.write_bytes(data)
  name=target.stem; binaries[name]=dict(path=item['path'],sha256=item['sha256'],env=name.upper().replace('-','_')+'_BIN')
 node=Path('C:/Program Files/nodejs/node.exe'); data=node.read_bytes(); assert sha(data)==lock['node']['sha256'],'Node drift'
 (destination/'node').mkdir(); (destination/'node/node.exe').write_bytes(data)
 manifest=dict(schema=1,release=lock['release'],cli='cli/dist/index.js',node=dict(path='node/node.exe',sha256=lock['node']['sha256'],version=lock['node']['version']),binaries=binaries,environment=dict(CAVEMAN_TELEMETRY='0',DO_NOT_TRACK='1',CAVE_PIXEL_MODELS='off'),files=[])
 manifest['optional_snapshots']=[dict(name=c['name'],version=c['version'],path='cli/'+c['path'],activation=False) for c in lock['optional']['components']]
 manifest['files']=[dict(path=str(p.relative_to(destination)).replace('\\','/'),sha256=sha(p.read_bytes())) for p in sorted(destination.rglob('*')) if p.is_file()]
 dump(destination/'release-manifest.json',manifest); verify_release(destination); print('PASS staged release hashes')
def verify_release(release):
 release=Path(release); m=load(release/'release-manifest.json')
 assert m['release']=='filin-20261007-r1'
 for item in m['files']: assert sha((release/item['path']).read_bytes())==item['sha256'],item['path']
 assert len(m['binaries'])==5
 return m

def transform_config(text,release,manifest,home):
 text=text.replace(json.dumps(str(home/'.caveman/bin/caveman-mcp.exe'))[1:-1],(release/'bin/caveman-mcp.exe').as_posix())
 text=text.replace((home/'.caveman/bin/caveman-browse.exe').as_posix(),(release/'bin/caveman-browse.exe').as_posix())
 env=dict(manifest['environment'],NODE=(release/manifest['node']['path']).as_posix())
 env.update({item['env']:(release/item['path']).as_posix() for item in manifest['binaries'].values()})
 for server in ['caveman','caveman_browse']:
  header=f'[mcp_servers.{server}.env]'
  # Insert only owned environment keys. Existing Chrome and unrelated fields survive byte-for-byte.
  lines='\n'.join(f'{k} = {json.dumps(v)}' for k,v in env.items())+'\n'
  if header in text:
   at=text.index(header)+len(header); text=text[:at]+ '\n'+lines+text[at:]
  else:
   match=re.search(r'\[mcp_servers\.'+server+r'\][\s\S]*?(?=\n\[|\Z)',text); assert match,'Missing MCP registration'
   at=text.index('# <<< caveman:native-tables',match.start(),match.end()) if server=='caveman' and '# <<< caveman:native-tables' in match.group() else match.end(); text=text[:at]+'\n'+header+'\n'+lines+text[at:]
 tomllib.loads(text)
 return text

def plan(home,release,directory,registration_release=None):
 home=Path(home).resolve(); release=Path(release).resolve(); directory=Path(directory).resolve(); m=verify_release(release); manifest_digest=sha((release/'release-manifest.json').read_bytes())
 if registration_release:release=Path(registration_release).resolve()
 assert not directory.is_relative_to(B),'Private backups must stay outside public package'
 directory.mkdir(parents=True,exist_ok=False); items=[]
 def add(path,kind,after):
  before=path.read_bytes(); after=after.encode('utf-8') if isinstance(after,str) else after
  if before==after:return
  n=len(items); (directory/f'{n}.before').write_bytes(before); (directory/f'{n}.after').write_bytes(after)
  items.append(dict(target=str(path),kind=kind,before_sha256=sha(before),after_sha256=sha(after),before=f'{n}.before',after=f'{n}.after'))
 hooks=home/'.codex/hooks.json'; doc=load(hooks); count=0
 for groups in doc['hooks'].values():
  for group in groups:
   for hook in group['hooks']:
    if 'caveman-proxy.exe' in hook.get('command','') and 'native-hook codex' in hook['command']:
     expected="& '"+(home/'.caveman/bin/caveman-proxy.exe').as_posix()+"' native-hook codex --adapter '"+(home/'AppData/Roaming/npm/node_modules/@caveman-ai/cli/dist/native-hook-fast.js').as_posix()+"'"
     assert hook['command']==expected,'Unexpected owned hook command flags require review'
     hook['command']="& '"+(release/'native-hook.ps1').as_posix()+"'"; count+=1
 assert count==12,f'Expected twelve owned hooks, found {count}'
 add(hooks,'hooks',json.dumps(doc,indent=2,ensure_ascii=False)+'\n')
 config=home/'.codex/config.toml'; old=config.read_bytes().decode('utf-8'); new=transform_config(old,release,m,home); add(config,'config',new)
 agents=home/'.codex/AGENTS.md'; replacements={'C:/Program Files/nodejs/node.exe':(release/'node/node.exe').as_posix(),(home/'AppData/Roaming/npm/node_modules/@caveman-ai/cli/dist/index.js').as_posix():(release/'cli/dist/index.js').as_posix()}
 for path in [agents]+list((home/'.codex/skills').glob('caveman*/**/*.md'))+list((home/'.codex/skills/cavecrew').glob('**/*.md')):
  if not path.is_file():continue
  text=path.read_bytes().decode('utf-8'); updated=text
  for oldpath,newpath in replacements.items():updated=updated.replace(oldpath,newpath)
  binding="All shell CLI Caveman invocations use `& '"+(release/'caveman.ps1').as_posix()+"' <args>` explicitly. Preserve existing home/CCR selections and ordinary command permissions. Bare `caveman` or `cave` executable names resolve mutable upstream shims. Slash skill aliases remain skill commands."
  if path==agents:
   end='<!-- caveman:active-local end -->';assert end in updated;updated=updated.replace(end,'- '+binding+'\n'+end)
  elif path.parent.name in ['caveman-help','caveman-learn','caveman-stats'] and path.name=='SKILL.md':
   updated=updated.rstrip()+'\n\n## Maintained CLI binding\n\n'+binding+'\n'
  add(path,'instructions',updated)
 journal=home/'.caveman/integrations/codex.json'; j=load(journal)
 for operation in j['operations']:
  if operation['kind']=='codex-config':
   start=new.index('# >>> caveman:native-tables') if '# >>> caveman:native-tables' in new else new.index('[model_providers.caveman]'); end=new.index('# <<< caveman:native-tables',start)+len('# <<< caveman:native-tables')
   operation['owned']['tables_block']=new[start:end]
  match=next((x for x in items if Path(x['target'])==Path(operation['file'])),None)
  if match:operation['after_sha256']='sha256:'+match['after_sha256']
 add(journal,'journal',json.dumps(j,indent=2,ensure_ascii=False)+'\n')
 dump(directory/'plan.json',dict(schema=1,release=str(release),home=str(home),release_manifest_sha256=manifest_digest,mutations=items,trust='ROOT hooks/list + config/batchWrite required. Never derive trusted_hash.',runtime='Existing backend may remain old until explicit restart.'))
 # Prove preserved unrelated hook values and config fragments, apart from owned environment/path lines.
 after_hooks=json.loads((directory/'0.after').read_text('utf-8')); before_hooks=load(hooks)
 for event,groups in before_hooks['hooks'].items():
  for i,group in enumerate(groups):
   for k,hook in enumerate(group['hooks']):
    other=after_hooks['hooks'][event][i]['hooks'][k]
    assert {x:y for x,y in hook.items() if x!='command'}=={x:y for x,y in other.items() if x!='command'}
    if 'caveman-proxy.exe' not in hook.get('command',''):assert hook==other
 dump(directory/'preservation.json',dict(status='PASS',owned_hooks=count,unrelated_hook_fields='exact',trust_hashes='unchanged',config_toml='parsed',state_files='never included'))
 print(f'PASS planned {len(items)} owned-file mutations; private backups kept in plan directory')

def atomic(path,data):
 path=Path(path)
 assert not path.is_symlink(),'Symlink target refused'
 fd,temp=tempfile.mkstemp(dir=path.parent,prefix='.caveman-maintained-')
 try:
  with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
  os.replace(temp,path)
 finally:
  if Path(temp).exists():Path(temp).unlink()

def mutate(directory,rollback=False):
 directory=Path(directory); p=load(directory/'plan.json'); verify_release(p['release'])
 assert sha((Path(p['release'])/'release-manifest.json').read_bytes())==p['release_manifest_sha256'],'Release manifest drift'
 home=Path(p['home']).resolve()
 for item in p['mutations']:
  owned=Path(item['target']).resolve(); kind=item['kind']
  allowed={'hooks':home/'.codex/hooks.json','config':home/'.codex/config.toml','journal':home/'.caveman/integrations/codex.json'}
  if kind=='instructions':
   relative=owned.relative_to(home/'.codex')
   assert relative==Path('AGENTS.md') or (len(relative.parts)>=3 and relative.parts[0]=='skills' and (relative.parts[1].startswith('caveman') or relative.parts[1]=='cavecrew') and owned.suffix=='.md'),'Unowned instruction target'
  else:assert kind in allowed and owned==allowed[kind],'Unowned mutation target'
  for version in ['before','after']:assert Path(item[version]).name==item[version],'Unowned backup path'
 source='after' if rollback else 'before'; target='before' if rollback else 'after'
 # All-file guard before the first write also protects newer state on rollback.
 for item in p['mutations']:
  path=Path(item['target']); assert not path.is_symlink(); assert sha(path.read_bytes())==item[source+'_sha256'],'Owned target drift'
  for version in ['before','after']: assert sha((directory/item[version]).read_bytes())==item[version+'_sha256'],'Backup drift'
 changed=[]
 try:
  for item in p['mutations']:
   assert sha(Path(item['target']).read_bytes())==item[source+'_sha256'],'Concurrent drift'
   atomic(item['target'],(directory/item[target]).read_bytes());changed.append(item)
 except BaseException:
  # Recover only this transaction's exact after-state. Never overwrite external changes.
  for item in reversed(changed):
   if sha(Path(item['target']).read_bytes())==item[target+'_sha256']:atomic(item['target'],(directory/item[source]).read_bytes())
  raise
 print('PASS rollback' if rollback else 'PASS applied guarded plan; trust and loaded runtime remain pending')
def verify(directory):
 p=load(Path(directory)/'plan.json'); verify_release(p['release'])
 for item in p['mutations']:assert sha(Path(item['target']).read_bytes())==item['after_sha256'],'Registration drift'
 print('PASS release and registration bytes; host delivery UNKNOWN')
def selfcheck():
 with tempfile.TemporaryDirectory(dir=Path.cwd()) as temp:
  root=Path(temp); rel=root/'release'; rel.mkdir(); dump(rel/'release-manifest.json',dict(release='filin-20261007-r1',files=[],binaries={str(i):{} for i in range(5)}))
  d=root/'plan';d.mkdir();target=root/'.codex/AGENTS.md';target.parent.mkdir();target.write_bytes(b'before');(d/'0.before').write_bytes(b'before');(d/'0.after').write_bytes(b'after')
  dump(d/'plan.json',dict(home=str(root),release=str(rel),release_manifest_sha256=sha((rel/'release-manifest.json').read_bytes()),mutations=[dict(target=str(target),kind='instructions',before='0.before',after='0.after',before_sha256=sha(b'before'),after_sha256=sha(b'after'))]))
  mutate(d); target.write_bytes(b'newer-state')
  try:mutate(d,True)
  except AssertionError:pass
  else:raise AssertionError('Rollback accepted drift')
  assert target.read_bytes()==b'newer-state'
  target.write_bytes(b'after'); mutate(d,True); assert target.read_bytes()==b'before'
 print('PASS fixture apply, rollback, newer-state preservation and drift rejection')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['stage','plan','apply','verify','rollback','self-check']);parser.add_argument('--release');parser.add_argument('--home',default=str(Path.home()));parser.add_argument('--plan');parser.add_argument('--registration-release');args=parser.parse_args()
 if args.action=='stage':stage(args.release,args.home)
 elif args.action=='plan':plan(args.home,args.release,args.plan,args.registration_release)
 elif args.action=='self-check':selfcheck()
 elif args.action=='verify':verify(args.plan)
 else:mutate(args.plan,args.action=='rollback')
