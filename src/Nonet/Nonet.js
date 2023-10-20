import Square from '../Square/Square';
import './Nonet.css';

let values = [0, 0, 0, 0, 0, 0, 0, 0, 0];

function Nonet() {
  return (
    <div className="nonet">
      <Square/>
      <Square/>
      <Square/>
      <Square/>
      <Square/>
      <Square/>
      <Square/>
      <Square/>
      <Square/>
    </div>
  );
}

export default Nonet;
