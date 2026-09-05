import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { LockIcon, SigilIcon } from './Icons';

export function Login({ onAuthenticated }: { onAuthenticated: (user: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const session = await api.login(username, password);
      onAuthenticated(session.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login gagal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story" aria-label="Aura Kingdom Operations">
        <div className="login-brand"><SigilIcon /> <span>Aura Kingdom</span></div>
        <div className="story-copy">
          <p className="kicker">Realm operations</p>
          <h1>Satu pandangan untuk menjaga seluruh Azuria tetap hidup.</h1>
          <p>Status shard, aktivitas pemain, log, dan kendali service—dikumpulkan dalam satu ruang operator.</p>
        </div>
        <div className="constellation" aria-hidden="true"><i/><i/><i/><i/><i/></div>
        <p className="story-foot">V15 · private realm console</p>
      </section>
      <section className="login-panel">
        <form onSubmit={submit} className="login-form">
          <div className="lock-mark"><LockIcon /></div>
          <h2>Masuk ke ruang kendali</h2>
          <p>Gunakan kredensial operator yang tersimpan di server.</p>
          <label>
            <span>Username</span>
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={submitting}>{submitting ? 'Memeriksa…' : 'Masuk'}</button>
        </form>
      </section>
    </main>
  );
}
