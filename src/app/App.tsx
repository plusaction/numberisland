import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { createAdaptiveState, DEFAULT_SETTINGS } from '../domain/edu/adaptive';
import { ko } from '../i18n/ko';
import { HubScreen } from '../ui/screens/HubScreen';
import { IntroScreen } from '../ui/screens/IntroScreen';
import { PlacementScreen } from '../ui/screens/PlacementScreen';
import { ResultScreen } from '../ui/screens/ResultScreen';
import { StageScreen } from '../ui/screens/StageScreen';
import { WelcomeScreen } from '../ui/screens/WelcomeScreen';
import { type App as AppHandle, bootApp, newProfile } from './bootstrap';
import { EngineDemo } from './EngineDemo';
import { WorldHost } from './WorldHost';

const params = new URLSearchParams(location.search);

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
  const reduced = usePrefersReducedMotion();
  switch (screen) {
    case 'boot':
      return null;
    case 'welcome':
      return (
        <WelcomeScreen
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
      return <HubScreen store={store} reducedMotion={reduced} />;
    case 'intro':
      return <IntroScreen store={store} />;
    case 'stage':
      return <StageScreen store={store} reducedMotion={reduced} />;
    case 'result':
      return <ResultScreen store={store} />;
  }
}

export function App() {
  const [app, setApp] = useState<AppHandle | null>(null);
  useEffect(() => {
    void bootApp().then(setApp);
  }, []);
  if (params.get('demo') === 'engine') return <EngineDemo />;
  return (
    <WorldHost>
      <main className="ui-layer" aria-label={ko.app.title}>
        {app ? <Screens app={app} /> : <p className="screen-center text-3xl font-bold">{ko.app.loading}</p>}
      </main>
    </WorldHost>
  );
}
