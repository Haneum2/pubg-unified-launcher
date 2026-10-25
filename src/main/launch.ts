import path from 'node:path';
import type { LaunchConfig, Phase, Server } from '../shared/types';
import { splitArgs } from './profile';

export interface LaunchCheck {
  server: Server;
  phase: Phase;
  steamPath: string | null;
  deadline: number;
  now: number;
  profileErrors: string[];
}

/** 실행하면 안 되는 이유. fail=true면 실패 상태로 표시, false면 현재 상태 유지(중복 클릭 등). */
export function launchBlockReason(c: LaunchCheck): { message: string; fail: boolean } | null {
  if (c.phase === 'game') return { message: '이미 게임이 실행 중입니다.', fail: false };
  if (c.phase === 'client' && c.now <= c.deadline)
    return { message: '이미 Steam에서 게임을 시작하는 중입니다. 잠시 기다려 주세요.', fail: false };
  if (c.profileErrors.length) return { message: `실행 옵션을 확인하세요: ${c.profileErrors[0]}`, fail: true };
  if (c.server === 'steam' && !c.steamPath)
    return { message: 'Steam이 설치되어 있지 않습니다. Steam을 설치하거나 [Steam 폴더 선택]으로 경로를 지정하세요.', fail: true };
  return null;
}

export type PollEvent = 'started' | 'ended' | 'timeout' | null;

/** 프로세스 목록 조회 결과로 상태가 어떻게 바뀌어야 하는지 정한다. */
export function pollEvent(phase: Phase, running: boolean, now: number, deadline: number): PollEvent {
  if (running) return phase === 'game' ? null : 'started';
  if (phase === 'game') return 'ended';
  if (phase === 'client' && now > deadline) return 'timeout';
  return null;
}

export function steamFailMessage(pubgLibrary: string | null, timeoutSec: number): string {
  return pubgLibrary
    ? `${timeoutSec}초 안에 게임이 뜨지 않았습니다. Steam 로그인 상태와 PUBG 업데이트 진행 여부를 확인하세요.`
    : 'Steam 라이브러리에서 PUBG를 찾지 못했습니다. Steam에서 PUBG를 설치한 뒤 다시 시도하세요.';
}

/**
 * Steam으로 넘길 실행 대상. 인자는 Steam 공식 경로(steam:// URL 또는 -applaunch)로만 전달하고
 * 게임 파일·Steam 설정 파일은 고치지 않는다.
 */
export function steamTarget(
  cfg: LaunchConfig,
  steamPath: string,
  steamArgs: string,
): { url: string } | { file: string; args: string[] } {
  const args = splitArgs(steamArgs);
  if (cfg.steamMethod === 'applaunch')
    return { file: path.win32.join(steamPath, 'steam.exe'), args: ['-applaunch', cfg.steamAppId, ...args] };
  return {
    url: args.length
      ? cfg.steamUrlWithArgs.replace('{appId}', cfg.steamAppId).replace('{args}', encodeURIComponent(args.join(' ')))
      : cfg.steamUrl.replace('{appId}', cfg.steamAppId),
  };
}
