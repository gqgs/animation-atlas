"""Reproduce elliptic-umbilic samples using a smooth finite-aperture Fourier integral.
Requires numpy, scipy. Run --validate for independent resolution/aperture checks.
The stored field uses NIST's positive Fourier sign, not numpy's forward sign.
"""
from pathlib import Path
import argparse, json, time, gc
import numpy as np
from scipy.fft import ifft2
from scipy.special import gamma

HERE = Path(__file__).resolve().parent
L = 24.0
K = 115
DZ = .025

def aperture(r, inner, outer):
    u = np.clip((r-inner)/(outer-inner), 0, 1)
    # C-infinity cutoff, exactly 1 in the stationary-point region.
    a = np.exp(-1/np.maximum(u, 1e-30))
    b = np.exp(-1/np.maximum(1-u, 1e-30))
    return b/(a+b)

class Integral:
    def __init__(self, n=4096, inner=6, outer=8):
        self.n = n
        v = (np.arange(n, dtype=np.float64)-n//2)*(2*L/n)
        s, t = v[None,:], v[:,None]
        self.r2 = s*s+t*t
        self.cubic = s*s*s-3*s*t*t
        self.window = aperture(np.sqrt(self.r2), inner, outer)
        self.indices = np.arange(-K,K+1) % n
        self.sign = (-1.)**(np.arange(-K,K+1)[:,None]+np.arange(-K,K+1)[None,:])
    def field(self, z):
        f = np.exp(1j*(self.cubic+z*self.r2))*self.window
        f = ifft2(f, overwrite_x=True, workers=2)
        return f[np.ix_(self.indices,self.indices)]*self.sign*(2*L)**2

def stats(a,b):
    d=np.abs(a-b)
    return dict(max_abs=float(d.max()), rms_abs=float(np.sqrt(np.mean(d*d))), relative_l2=float(np.linalg.norm(a-b)/np.linalg.norm(b)))

def validate():
    report={"method":"smooth finite-aperture FFT; complex-field errors, not relative phase near zeros", "checks":[]}
    base=Integral()
    fields={z:base.field(z) for z in [0,2,4]}
    exact=2*np.pi/(3*2**(1/3))*gamma(1/3)/gamma(2/3)
    origin=fields[0][K,K]
    report['origin']={"analytic":float(exact),"computed_real":float(origin.real),"computed_imag":float(origin.imag),"abs_error":float(abs(origin-exact))}
    del base;gc.collect()
    for label,params in [('resolution',dict(n=6144,inner=6,outer=8)),('aperture',dict(n=6144,inner=8,outer=10))]:
        q=Integral(**params)
        for z in [0,2,4]:
            other=q.field(z)
            report['checks'].append(dict(check=label,z=z,**stats(fields[z],other)))
        del q;gc.collect()
    q=Integral()
    mid=q.field(3.9875)
    interp=(q.field(3.975)+fields[4])/2
    report['temporal_interpolation']=stats(interp,mid)
    # Independent phase symmetry under y -> -y is exact analytically.
    report['reflection']=stats(fields[4],fields[4][::-1])
    quant=np.stack([fields[4].real,fields[4].imag],axis=-1).astype('<f2').astype(float)
    report['float16']=stats(quant[...,0]+1j*quant[...,1],fields[4])
    print(json.dumps(report,indent=2),flush=True)
    assert report['origin']['abs_error']<1e-3
    assert all(c['max_abs']<.01 for c in report['checks'])
    assert report['reflection']['max_abs']<1e-5
    (HERE/'validation.json').write_text(json.dumps(report,indent=2)+'\n')

def generate():
    q=Integral()
    count=round(4/DZ)+1
    start=time.time()
    chunks=[]
    out=None
    try:
        for j in range(count):
            if j%20==0:
                if out: out.close()
                name=f'field-{j//20:03d}.bin'
                chunks.append(name)
                out=(HERE/name).open('wb')
            f=q.field(j*DZ)
            xy=np.stack([f.real,f.imag],axis=-1).astype('<f2')
            assert np.all(np.isfinite(xy))
            out.write(xy.tobytes())
            if j%20==0: print(f'{j}/{count-1} frames · {time.time()-start:.1f}s',flush=True)
    finally:
        if out: out.close()
    meta={"chunks":chunks,"version":1,"family":"elliptic umbilic","width":2*K+1,"height":2*K+1,"frames":count,"zMin":0,"zMax":4,"zStep":DZ,"xyMin":-K*np.pi/L,"xyMax":K*np.pi/L,"xyStep":np.pi/L,"format":"little-endian float16, frame/y/x/(real,imag), y increases with row", "normalization":"NIST DLMF 36.2.5; positive Fourier sign; no intensity renormalization per frame", "fftSize":4096,"integrationHalfWidth":L,"apertureInner":6,"apertureOuter":8}
    (HERE/'field.json').write_text(json.dumps(meta,indent=2)+'\n')
    print('complete',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--validate',action='store_true');a=p.parse_args()
    validate() if a.validate else generate()
