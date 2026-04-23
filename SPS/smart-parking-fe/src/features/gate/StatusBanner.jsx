export default function StatusBanner({ tone = "neutral", title, message, extra }) {
  return (
    <div className={`scan-feedback scan-feedback--${tone}`}>
      <strong>{title}</strong>
      <p>{message}</p>
      {extra ? <p>{extra}</p> : null}
    </div>
  );
}
