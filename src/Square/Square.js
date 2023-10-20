import './Square.css'

let value = 0;

function handleChange(text) {
  value = Number(text.target.value);
  console.log(value);
}

function Square() {

  return (
    <div className="square">
      <input className="input" maxLength="1" type="text" onChange={handleChange}></input>
    </div>
  );
}

export default Square;
