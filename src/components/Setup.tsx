export default function Setup() {
  return (
    <div className="setup">
      <div className="brand" style={{ padding: '0 0 20px' }}>
        <div className="logo">S</div>
        <div>
          <b>Suricatus</b>
          <span>CRM Comercial</span>
        </div>
      </div>
      <h2>Falta conectar o Supabase</h2>
      <p style={{ color: 'var(--muted)' }}>
        O app está funcionando, mas ainda não sabe onde guardar os dados. Siga o passo a passo:
      </p>
      <ol style={{ color: 'var(--muted)', paddingLeft: 18 }}>
        <li>Crie um projeto grátis em <code>supabase.com</code>.</li>
        <li>No <b>SQL Editor</b>, cole e rode o conteúdo de <code>supabase/schema.sql</code>.</li>
        <li>Em <b>Project Settings → API</b>, copie a <b>Project URL</b> e a <b>anon public key</b>.</li>
        <li>
          Na raiz do projeto, crie um arquivo <code>.env</code> com:
          <pre>{`VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-public-key`}</pre>
        </li>
        <li>Reinicie o <code>npm run dev</code>.</li>
      </ol>
      <p style={{ color: 'var(--dim)', fontSize: 12 }}>
        O README.md tem esse mesmo guia com mais detalhes, incluindo como criar os usuários da equipe.
      </p>
    </div>
  );
}
