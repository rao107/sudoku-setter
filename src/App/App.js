import Grid from '../Grid/Grid';
import Button from '../Button/Button';
import clicky from '../sat-solving'
import './App.css';

function App() {
  return (
    <div className="App">
      <h1>Sudoku Setter</h1>
      <Grid></Grid>
      <Button text="Solve" onClick={clicky}></Button>
    </div>
  );
}

export default App;
