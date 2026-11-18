import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { createAdaptiveState, DEFAULT_SETTINGS } from '../domain/edu/adaptive';
import type { StageId } from '../domain/stage/types';
import { ko } from '../i18n/ko';
import { STAGE_LOADERS } from '../stages/registry';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { HubScreen } from '../ui/screens/HubScreen';
import { IntroScreen } from '../ui/screens/IntroScreen';
import { PlacementScreen } from '../ui/screens/PlacementScreen';
import { WelcomeScreen } from '../ui/screens/WelcomeScreen';
import { type App as AppHandle, bootApp, newProfile } from './bootstrap';
import { WorldHost } from './WorldHost';

const params = new URLSearchParams(location.search);

// Not needed for the first screen: fetched later (and warmed up in idle time once the island is up),
// so the title screen's own download stays small
const loadStage = () => import('../ui/screens/StageScreen');
const loadResult = () => import('../ui/screens/ResultScreen');
const StageScreen = lazy(() => loadStage().then((m) => ({ default: m.StageScreen })));
const ResultScreen = lazy(() => loadResult().then((m) => ({ default: m.ResultScreen })));
const EngineDemo = lazy(() => import('./EngineDemo').then((m) => ({ default: m.EngineDemo })));
/** Fetch the play screens in the background while the child looks at the island. */
export function prefetchPlay(stage?: StageId) {
  const idle = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback;
  const go = () => {
    void loadStage();
    void loadResult();
    // the stage the child is about to start (its rules + scene chunk)
    if (stage) void STAGE_LOADERS[stage]?.();
  };
  // a busy 3D page may never be idle: start within 1.5 s regardless
  if (idle) idle(go, { timeout: 1500 });
  else globalThis.setTimeout(go, 300);
}

function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function Screens({ app }: { app: AppHandle }) {
  const { store, db } = app;
  const screen = useStore(store, (s) => s.screen);
  const profile = useStore(store, (s) => s.profile);
  const system = usePrefersReducedMotion();
  // the child's own setting wins over the system preference (설정 → 움직임 줄이기)
  const pref = profile?.settings.reducedMotion ?? 'system';
  const reduced = pref === 'system' ? system : pref;
  switch (screen) {
    case 'boot':
      return null;
    case 'welcome':
      return (
        <WelcomeScreen
          reducedMotion={reduced}
          onStart={(nick) => {
            const p = newProfile(nick);
            void db.setMeta('lastProfile', p.id);
            store.getState().setProfile(p);
            store.getState().go('placement');
          }}
        />
      );
    case 'placement':
      return profile ? (
        <PlacementScreen
          reducedMotion={reduced}
          settings={{
            ...DEFAULT_SETTINGS,
            term: profile.settings.term,
            challengeEnabled: profile.settings.challengeEnabled,
          }}
          seed={profile.id}
          onDone={(level) => {
            store
              .getState()
              .setProfile({ ...profile, placementDone: true, adaptive: createAdaptiveState(level) });
            store.getState().go('hub');
          }}
        />
      ) : null;
    case 'hub':
    case 'intro':
      prefetchPlay(screen === 'intro' ? store.getState().selected : undefined);
      // the intro card floats over the living island (same HubScreen instance: the 3D scene stays up)
      return (
        <>
          <HubScreen store={store} reducedMotion={reduced} quiet={screen === 'intro'} />
          {screen === 'intro' && <IntroScreen store={store} />}
        </>
      );
    case 'stage':
      return (
        <Suspense fallback={null}>
          <StageScreen store={store} reducedMotion={reduced} />
        </Suspense>
      );
    case 'result':
      return (
        <Suspense fallback={null}>
          <ResultScreen store={store} />
        </Suspense>
      );
  }
}

export function App() {
  const [app, setApp] = useState<AppHandle | null>(null);
  useEffect(() => {
    void bootApp().then(setApp);
  }, []);
  if (params.get('demo') === 'engine')
    return (
      <Suspense fallback={null}>
        <EngineDemo />
      </Suspense>
    );
  return (
    <WorldHost>
      <main className="ui-layer" aria-label={ko.app.title}>
        <ErrorBoundary>
          {app ? (
            <Screens app={app} />
          ) : (
            <div className="loading-screen" role="status">
              <p className="loading-title">{ko.app.title}</p>
              <span className="loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p className="loading-text">{ko.app.loading}</p>
            </div>
          )}
        </ErrorBoundary>
      </main>
    </WorldHost>
  );
}
