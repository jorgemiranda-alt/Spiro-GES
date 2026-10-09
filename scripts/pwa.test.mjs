import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const source = await fs.readFile(publicDir+'js/pwa.js', 'utf8');
const html = await fs.readFile(publicDir+'index.html', 'utf8');
const manifest = JSON.parse(await fs.readFile(publicDir+'manifest.webmanifest', 'utf8'));

test('installed app identity and launch URL work at root and GitHub Pages paths', () => {
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.name && manifest.short_name && manifest.theme_color && manifest.background_color);
  for (const path of ['/', '/Spiro-GES/']) {
    const base = 'https://example.test'+path;
    for (const field of ['id','start_url','scope']) assert.equal(new URL(manifest[field],base).href,base);
  }
  assert.match(html,/<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html,/viewport-fit=cover/);
  assert.ok(html.indexOf('js/pwa.js')<html.indexOf('js/views.js'),'installation controls load before rendering');
});

test('Android and Apple home-screen icons exist at their declared sizes', async () => {
  for (const size of [192,512]) assert.ok(manifest.icons.some(icon => icon.sizes===`${size}x${size}` && icon.purpose==='any'));
  assert.ok(manifest.icons.some(icon => icon.purpose==='maskable'));
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="icons\/apple-touch-icon.png">/);
  for (const icon of [...manifest.icons,{src:'icons/apple-touch-icon.png',sizes:'180x180'}]) {
    const bytes = await fs.readFile(publicDir+icon.src);
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,icon.sizes);
  }
});

function harness({scope='https://example.test/Spiro-GES/',secure=true,ios=false,ipad=false,standalone=false,appleStandalone=false} = {}) {
  const handlers = {}, container = {innerHTML:''};
  const metrics = {prompts:0,toasts:[],prevented:0};
  const on = target => (type,handler)=>{(handlers[target+type]||=[]).push(handler);};
  const navigator = {userAgent:ios?'iPhone':'Chrome',platform:ipad?'MacIntel':'',maxTouchPoints:ipad?5:0,standalone:appleStandalone};
  const display = {matches:standalone,addEventListener:on('display')};
  const window = {isSecureContext:secure,matchMedia:()=>display,addEventListener:on('window')};
  const document = {currentScript:{src:new URL('js/pwa.js?v=1',scope).href},addEventListener:on('document'),querySelector:()=>container};
  const context = vm.createContext({window,document,navigator,URL,S:{lang:'en'},esc:String,icon:()=>'<svg></svg>',toast:message=>metrics.toasts.push(message)});
  vm.runInContext(source,context);
  const fire = async(target,type,event={}) => {
    for (const handler of handlers[target+type]||[]) await handler(event);
  };
  const click = () => fire('document','click',{target:{closest:()=>({dataset:{pwaAct:'install'},disabled:false})}});
  const prompt = userChoice => fire('window','beforeinstallprompt',{
    preventDefault:()=>metrics.prevented++,prompt:async()=>metrics.prompts++,userChoice
  });
  return {context,metrics,container,display,fire,click,prompt,controls:()=>vm.runInContext('PWA.controls()',context)};
}

test('Android install control invokes one native prompt even with repeat taps', async () => {
  const h=harness();
  let finish;
  const choice=new Promise(resolve=>{finish=resolve;});
  await h.prompt(choice);
  assert.match(h.controls(),/data-pwa-act="install"/);
  assert.equal(h.metrics.prevented,1);
  const first=h.click();
  await h.click();
  assert.equal(h.metrics.prompts,1);
  assert.match(h.controls(),/disabled/);
  finish({outcome:'dismissed'});
  await first;
  assert.doesNotMatch(h.controls(),/data-pwa-act="install"/);
  assert.match(h.controls(),/browser menu/);
});

test('failed native installation restores browser-menu help and gives recovery advice', async () => {
  const h=harness();
  await h.fire('window','beforeinstallprompt',{preventDefault:()=>{},prompt:async()=>{throw new Error('Unavailable');}});
  await h.click();
  assert.equal(h.metrics.toasts.length,1);
  assert.match(h.metrics.toasts[0],/browser menu/);
  assert.match(h.controls(),/pwa-install-help/);
});

test('iPhone and desktop-mode iPad receive home-screen guidance in every supported language', () => {
  for (const options of [{ios:true},{ipad:true}]) {
    const h=harness(options);
    assert.match(h.controls(),/Add to Home Screen/);
    assert.match(h.controls(),/Share/);
    for (const lang of ['fr','de','nl','pl']) {
      h.context.S.lang=lang;
      assert.doesNotMatch(h.controls(),/Add to Home Screen/);
      assert.match(h.controls(),/pwa-install-help/);
    }
  }
});

test('installation controls disappear in installed Android/iOS windows and after installation', async () => {
  for (const options of [{standalone:true},{ios:true,appleStandalone:true}]) assert.equal(harness(options).controls(),'');
  const h=harness();
  await h.prompt(Promise.resolve({outcome:'accepted'}));
  await h.click();
  await h.fire('window','appinstalled');
  assert.equal(h.controls(),'');
  assert.equal(h.container.innerHTML,'');
  const display=harness();
  display.display.matches=true;
  await display.fire('display','change');
  assert.equal(display.container.innerHTML,'');
});

test('installation guidance is omitted for file URLs and insecure phone LAN previews', () => {
  for (const options of [{secure:false,scope:'http://192.168.1.10/demo/'},{scope:'file:///demo/'}]) assert.equal(harness(options).controls(),'');
});
