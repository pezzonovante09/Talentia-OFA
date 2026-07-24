export default function Home() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "3rem auto",
        padding: "0 1.25rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1>Talentia API</h1>
      <p>AI proxy for the Talentia mobile app (Tali, TTS, parent reports).</p>
      <ul>
        <li>
          <a href="/privacy">Privacy Policy</a>
        </li>
        <li>
          <a href="/terms">Terms of Use</a>
        </li>
        <li>
          <code>/api/ping</code>, <code>/api/tali</code>, <code>/api/tts</code>, <code>/api/report*</code>,{" "}
          <code>/api/account/delete</code>
        </li>
      </ul>
    </main>
  );
}
