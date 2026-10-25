import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectSteam, findAppLibrary } from './steam';

const has = (...dirs: string[]) => (p: string) => dirs.some((d) => p.toLowerCase() === `${d}\\steam.exe`.toLowerCase());
const noReg = () => null;

test('레지스트리 SteamPath(슬래시 경로)를 정규화해 찾는다', () => {
  const reg = (k: string, v: string) => (v === 'SteamPath' ? 'd:/games/steam' : null);
  assert.equal(detectSteam(undefined, reg, has('D:\\games\\steam')), 'd:\\games\\steam');
});

test('HKCU가 없으면 HKLM InstallPath로 찾는다', () => {
  const reg = (k: string, v: string) => (v === 'InstallPath' ? 'E:\\Steam' : null);
  assert.equal(detectSteam(undefined, reg, has('E:\\Steam')), 'E:\\Steam');
});

test('수동 지정 경로가 유효하면 레지스트리보다 우선한다', () => {
  const reg = () => 'C:\\Program Files (x86)\\Steam';
  assert.equal(detectSteam('F:\\MySteam', reg, has('F:\\MySteam', 'C:\\Program Files (x86)\\Steam')), 'F:\\MySteam');
});

test('수동 경로에 steam.exe가 없으면 무시하고 기본 경로로 넘어간다', () => {
  assert.equal(detectSteam('F:\\Wrong', noReg, has('C:\\Program Files (x86)\\Steam')), 'C:\\Program Files (x86)\\Steam');
});

test('어디에도 없으면 null (미설치)', () => {
  assert.equal(detectSteam(undefined, noReg, () => false), null);
});

const VDF = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t\t"label"\t\t""
\t\t"apps"
\t\t{
\t\t\t"228980"\t\t"611623377"
\t\t}
\t}
\t"1"
\t{
\t\t"path"\t\t"D:\\\\SteamLibrary"
\t\t"contentid"\t\t"578080"
\t\t"apps"
\t\t{
\t\t\t"578080"\t\t"53058830336"
\t\t}
\t}
}`;

test('libraryfolders.vdf에서 앱이 있는 라이브러리를 찾는다', () => {
  assert.equal(findAppLibrary(VDF, '578080'), 'D:\\SteamLibrary');
});

test('apps 밖의 같은 숫자(contentid 등)는 무시하고, 없으면 null', () => {
  assert.equal(findAppLibrary(VDF.replace('"578080"\t\t"53058830336"', ''), '578080'), null);
});
