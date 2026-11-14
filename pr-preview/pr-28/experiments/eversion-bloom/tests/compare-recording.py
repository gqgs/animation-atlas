import json,sys,pathlib
import numpy as np
from PIL import Image,ImageFilter,ImageChops
p=pathlib.Path(sys.argv[1]);capture=json.loads((p/'capture.json').read_text());bg=np.asarray(Image.open(p/'background.png').convert('RGB'),dtype=np.int16);report=[]
for frame in capture['selected']:
 raw=np.asarray(Image.open(p/f'raw-{frame}.png').convert('RGB'),dtype=np.int16);dec=np.asarray(Image.open(p/f'decoded-{frame}.png').convert('RGB'),dtype=np.int16);ui=np.asarray(Image.open(p/f'ui-decoded-{frame}.png').convert('RGB'),dtype=np.int16);fresh=np.asarray(Image.open(p/f'fresh-{frame}.png').convert('RGB'),dtype=np.int16)
 mask=np.asarray(Image.open(p/f'mask-{frame}.png').convert('L').filter(ImageFilter.MaxFilter(21)))<1
 delta=np.max(abs(dec-raw),axis=2);raw_delta=np.max(abs(raw-bg),axis=2);fresh_delta=np.max(abs(fresh-raw),axis=2)
 entry=dict(frame=frame,phase=frame/capture['total'],raw_outside_over_3=int(np.sum((raw_delta>3)&mask)),decoded_outside_over_12=int(np.sum((delta>12)&mask)),decoded_outside_over_24=int(np.sum((delta>24)&mask)),max_outside_error=int(delta[mask].max()),mean_absolute_error=float(np.mean(abs(dec-raw))),fresh_max_difference=int(fresh_delta.max()),fresh_changed_pixels=int(np.sum(fresh_delta>0)))
 ui_delta=np.max(abs(ui-raw),axis=2);entry.update(ui_outside_over_12=int(np.sum((ui_delta>12)&mask)),ui_outside_over_24=int(np.sum((ui_delta>24)&mask)),ui_max_outside_error=int(ui_delta[mask].max()),ui_mean_absolute_error=float(np.mean(abs(ui-raw))))
 report.append(entry)
 diff=np.clip(abs(dec-raw)*8,0,255).astype(np.uint8);Image.fromarray(diff).save(p/f'difference-{frame}.png')
 thumb=Image.new('RGB',(1200,400));
 for i,name in enumerate(['raw','decoded','difference']):
  im=Image.open(p/f'{name}-{frame}.png').convert('RGB');im.thumbnail((400,400));thumb.paste(im,(i*400,0))
 thumb.save(p/f'comparison-{frame}.jpg',quality=95)
(p/'comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

for entry in report:
 assert entry['raw_outside_over_3']==0, entry
 assert entry['fresh_max_difference']==0, entry
 assert entry['ui_outside_over_12']==0, entry
print('PASS: clean raw/background, exact seeks and no decoded UI residue outside silhouette')
