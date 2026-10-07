import argparse,json,tempfile,urllib.request
from pathlib import Path
API='https://api.github.com/repos/JuliusBrussee/caveman/'
def compare(state,metadata):
 current={k:metadata[k] for k in ['release','main','error'] if k in metadata}
 previous=json.loads(state.read_text('utf-8')) if state.exists() else None
 changed=previous is not None and previous!=current
 state.parent.mkdir(parents=True,exist_ok=True)
 state.write_text(json.dumps(current,sort_keys=True)+'\n','utf-8')
 return dict(changed=changed,notify=changed or (previous is None and 'error' in current),baseline=previous is None,metadata=current)
def fetch():
 def get(route):
  request=urllib.request.Request(API+route,headers={'Accept':'application/vnd.github+json','User-Agent':'filins-caveman-readonly-watch'})
  with urllib.request.urlopen(request,timeout=20) as response:
   payload=response.read(1024*1024+1)
   if len(payload)>1024*1024:raise ValueError('Metadata response exceeds 1 MiB')
   return json.loads(payload)
 release=get('releases/latest'); commit=get('commits/main')
 return dict(release=dict(tag=release['tag_name'],published=release['published_at'],url=release['html_url']),main=dict(sha=commit['sha'],url=commit['html_url']))
def selfcheck(directory):
 directory.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(dir=directory) as temporary:
  state=Path(temporary)/'watch-fixture.json'; first=dict(release={'tag':'v1'},main={'sha':'a'})
  assert not compare(state,first)['notify'];assert not compare(state,first)['notify']
  assert compare(state,dict(release={'tag':'v2'},main={'sha':'a'}))['notify']
  assert not compare(state,dict(release={'tag':'v2'},main={'sha':'a'}))['notify']
  assert compare(state,{'error':'network'})['notify']; assert not compare(state,{'error':'network'})['notify']
  print('PASS watch baseline, unchanged, new-change and no-repeat failure fixtures')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--state',required=True);parser.add_argument('--fixture');parser.add_argument('--self-check',action='store_true');args=parser.parse_args();state=Path(args.state)
 if args.self_check:selfcheck(state.parent)
 else:
  try:metadata=json.loads(Path(args.fixture).read_text('utf-8')) if args.fixture else fetch()
  except Exception as error:metadata={'error':type(error).__name__+': '+str(error)[:512]}
  print(json.dumps(compare(state,metadata)))
