export function simplifyExpression(expression) {
  const startLen = expression.length;
  expression = regroupOrCriteria(expression);
  const endLen = expression.length;
  if (endLen !== startLen)
    console.log(`simplifyExpression went from ${startLen} args to ${endLen}`);
  return expression;
}

// [any, [in, klasse, A, B, C], [=, klasse, D], [=, klasse, C]]
// to
// [any, [in, klasse, A, B, C, D]]
function regroupOrCriteria(expression) {
  const operator = expression[0];
  const args = expression.slice(1);
  if (operator !== "any") {
    return expression;
  }

  function collectValuesForProp(propName) {
    const collected = [];
    // loop backwards and remove elements once collected
    for (let i = args.length - 1; i >= 0; i--) {
      const expr = args[i];
      if (expr[0] !== "in" && expr[0] !== "==") continue;
      const values = expr
        .slice(2)
        .filter((value) =>
          collected.every((v) => JSON.stringify(v) !== JSON.stringify(value))
        );
      collected.push(...values);
      args.splice(i, 1);
    }
    return collected;
  }

  for (let i = 0; i < args.length; i++) {
    const expr = args[i];
    if (!Array.isArray(expr)) continue;
    if (expr[0] !== "in" && expr[0] !== "==") continue;
    const propName = getPropName(expr[1]);
    args[i] = ["in", ["get", propName], ...collectValuesForProp(propName)];
  }

  return [operator, ...args];
}

function getPropName(expr) {
  if (Array.isArray(expr) && expr[0] === "get") return expr[1];
  else if (typeof expr === "string") return expr;
  else throw new Error("expected prop here??");
}
