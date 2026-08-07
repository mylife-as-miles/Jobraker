// TEMPORARY verification harness. Delete after visual review.
// Confirms the exact mechanic the 2FA fix relies on: turning Supabase's raw
// SVG `totp.qr_code` string into a data: URL an <img> can actually paint.
const SAMPLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29">' +
  '<rect width="29" height="29" fill="#ffffff"/>' +
  '<path fill="#000000" d="M0 0h7v7H0zM22 0h7v7h-22zM0 22h7v7H0z' +
  'M9 9h2v2H9zM13 9h2v2h-2zM17 9h2v2h-2zM9 13h2v2H9zM17 13h2v2h-2z' +
  'M9 17h2v2H9zM13 17h2v2h-2zM17 17h2v2h-2z"/>' +
  '</svg>';

export const QrDataUriHarness = () => {
  const src = `data:image/svg+xml;utf-8,${encodeURIComponent(SAMPLE_SVG)}`;
  return (
    <div style={{ padding: 32, background: "#0a0a0a", minHeight: "100vh" }}>
      <p style={{ color: "#fff", marginBottom: 16 }}>
        If a checkerboard QR-like square renders below, the data-URI mechanic
        used by the fixed 2FA enrollment flow works correctly.
      </p>
      <div
        data-testid="qr-harness-wrapper"
        style={{
          background: "#fff",
          padding: 12,
          borderRadius: 12,
          width: 220,
          height: 220,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          data-testid="qr-harness-image"
          src={src}
          alt="QR data URI test"
          width={196}
          height={196}
        />
      </div>
    </div>
  );
};

export default QrDataUriHarness;
