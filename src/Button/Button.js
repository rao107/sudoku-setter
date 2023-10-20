function Button({text, onClick}) {
  return (
    <div className="button">
      <button onClick={onClick}>{text}</button>
    </div>
  );
}

export default Button;
