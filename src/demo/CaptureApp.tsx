// React import removed: the automatic JSX runtime is configured.
import SpecimenGridPulse, { SpecimenGridPreset } from '../GridPulseScanPro'
import { GridPulseEffect, GridPulsePoint } from '../GridPulseScanPro'

const params = new URLSearchParams(location.search)
const preset = (params.get('preset') || 'Feature Tracking') as SpecimenGridPreset
const effect = (params.get('effect') || 'none') as GridPulseEffect
const composition = (params.get('composition') || 'integrated') as 'integrated'|'grid-pulse'|'specimen'

const points: GridPulsePoint[] = [
  {x:.31,y:.31,score:.99,id:'PETAL-01'},
  {x:.60,y:.31,score:.97,id:'PETAL-02'},
  {x:.47,y:.56,score:.96,id:'CORE-03'},
  {x:.72,y:.58,score:.93,id:'VEIN-04'},
  {x:.34,y:.72,score:.90,id:'EDGE-05'},
  {x:.63,y:.78,score:.88,id:'PETAL-06'},
]

export default function CaptureApp(){
  return <main style={{width:'100vw',height:'100vh',background:'#050605',padding:18,boxSizing:'border-box'}}>
    <SpecimenGridPulse
      src="./pink-flower.jpeg"
      alt="Pink translucent flower"
      aspectRatio="4:5"
      preset={preset}
      media={{objectFit:'cover',positionX:.5,positionY:.5}}
      detection={{mode:'custom',pointCount:6,manualPoints:points,mobilePointLimit:3,minDistance:.08}}
      specimen={{
        composition, finish:'laboratory', accentColor:'#cfff55', magnification:2.25,
        distortion:3.1,density:20,guideOpacity:.9,trackingFrameScale:1,
        showGuideLines:true,guideStyle:'hybrid',showControls:true,controlVariant:'rail',
        rendererProfile: preset === 'Survey Grid' ? 'survey' : preset === 'Botanical Analysis' ? 'botanical' : 'feature',
        proceduralNoise:.42,temporalPersistence:.14,particleDensity:.16,
        lensBarrelDistortion:.05,lensChromaticAberration:.9,lensFresnel:.22,lensRefraction:.36,lensBloom:.2,
        acquisitionChoreography:true,filmDistortion:.48,gridPulse:.58,scanWaves:true,scanWaveStrength:.78,typeLabels:true,
        maxOverlayFps:40,mediaSampleRate:18,
      }}
      interaction={{activation:'always',clickToRescan:true,mobileAlwaysOn:true,cursor:'crosshair'}}
      effect={{type:effect,scope:effect==='none'?'boxes':'both',refreshRate:12}}
      rendering={{maxFps:60,staticImageFps:30,inactiveFps:4,dprCap:1.5,demandDriven:true,useVideoFrameCallback:true,pauseWhenOffscreen:false}}
      style={{width:'100%',height:'100%',minHeight:0}}
    />
  </main>
}
