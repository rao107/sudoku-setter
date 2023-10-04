import { Int, And, Solver, Context } from 'z3-solver';

const context = new Context('main');

const x = Int.const('x');

const solver = new Solver();
solver.add(And(x.ge(0), x.le(9)));
console.log(solver.check());
