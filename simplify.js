export function simplifyExpression(expression) {
  const startLen = JSON.stringify(expression).length;
  function simplify(expr) {
    if (!Array.isArray(expr)) return expr;
    for (let i = 1; i < expr.length; i++) {
      expr[i] = simplify(expr[i]);
    }
    expr = expr.filter((a) => a !== null); // remove null entries which may result from simplification
    expr = regroupOrCriteria(expr);
    expr = removeUnnecessaryNestedCriteria(expr);
    expr = removeSingleArgOperators(expr);
    expr = collapseIdenticalLogicalOperators(expr);
    expr = expr.filter((a) => a !== null);
    return expr;
  }
  expression = simplify(expression);
  expression = simplify(expression);
  expression = simplify(expression);
  const endLen = JSON.stringify(expression).length;
  if (endLen !== startLen)
    console.log(
      `simplifyExpression went from ${startLen} chars to ${endLen} (${(
        (100 * (startLen - endLen)) /
        startLen
      ).toFixed(1)}% reduction)`
    );
  return expression;
}

// [any, [in, klasse, A, B, C], [=, klasse, D], [=, klasse, C]]
// to
// [any, [in, klasse, A, B, C, D]]
function regroupOrCriteria(expression) {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const operator = expression[0];
  if (operator !== "any") {
    return expression;
  }
  const args = expression.slice(1);

  function collectValuesForProp(propName) {
    const collected = [];
    // loop backwards and remove elements once collected
    for (let i = args.length - 1; i >= 0; i--) {
      const expr = args[i];
      if (!Array.isArray(expr)) continue;
      if (expr[0] !== "in" && expr[0] !== "==") continue;
      if (propName !== getPropName(expr[1])) continue;
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

// [any,
//    [and, [in, klasse, A, B, C, D], [=, type, X]],
//    [in, klasse, C, D]
// ]
// to
// [any,
//    [and, [in, klasse, A, B], [=, type, X]],
//    [in, klasse, C, D]
// ]
//
// [any,
//    [and, [in, klasse, C, D], [=, type, X]],
//    [in, klasse, C, D]
// ]
// to
// [any,
//    [in, klasse, C, D]
// ]
function removeUnnecessaryNestedCriteria(expression) {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const operator = expression[0];
  const args = expression.slice(1);
  if (operator !== "any") {
    return expression;
  }

  function getExistingOptionsForProp(propName) {
    const options = [];
    // loop backwards and remove elements once collected
    for (let i = args.length - 1; i >= 0; i--) {
      if (args[i] === null) continue;
      const expr = args[i];
      if (expr[0] !== "in" && expr[0] !== "==") continue;
      if (propName !== getPropName(expr[1])) continue;
      const values = expr.slice(2);
      options.push(...values);
    }
    return options;
  }

  function trimUnnecessaryOptions(expr) {
    if (expr[0] !== "in" && expr[0] !== "==") return expr;
    const propName = getPropName(expr[1]);
    const options = getExistingOptionsForProp(propName);
    const newOptions = expr
      .slice(2)
      .filter((option) =>
        options.every((v) => JSON.stringify(v) !== JSON.stringify(option))
      );
    if (!newOptions.length) return null;
    return [
      newOptions.length > 1 ? "in" : "==",
      ["get", propName],
      ...newOptions,
    ];
  }

  for (let i = 0; i < args.length; i++) {
    const expr = args[i];
    if (!Array.isArray(expr)) continue;
    if (expr[0] !== "all") continue;
    let newArgs = expr.slice(1).map(trimUnnecessaryOptions);
    if (newArgs.some((arg) => arg === null) || newArgs.length === 0) {
      args[i] = null;
    } else if (newArgs.length > 1) {
      args[i] = ["all", ...newArgs];
    } else {
      args[i] = newArgs[0];
    }
  }

  return [operator, ...args];
}

function removeSingleArgOperators(expression) {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const operator = expression[0];
  if (operator !== "any" && operator !== "all") {
    return expression;
  }
  const args = expression.slice(1);
  const uniqueArgs = args.filter(
    (v, i) =>
      args.findIndex((a) => JSON.stringify(a) === JSON.stringify(v)) === i
  );
  if (uniqueArgs.length === 1) {
    return args[0];
  }
  if (uniqueArgs.length === 0) {
    return null;
  }
  return [expression[0], ...uniqueArgs];
}

function collapseIdenticalLogicalOperators(expression) {
  if (!Array.isArray(expression)) {
    return expression;
  }
  const operator = expression[0];
  if (operator !== "any" && operator !== "all") {
    return expression;
  }
  const args = expression.slice(1);
  const newArgs = args.reduce((prev, curr) => {
    if (!Array.isArray(curr)) {
      return [...prev, curr];
    }
    const childOperator = curr[0];
    if (childOperator !== operator) {
      return [...prev, curr];
    }
    return [...prev, ...curr.slice(1)];
  }, []);
  return [expression[0], ...newArgs];
}

function getPropName(expr) {
  if (Array.isArray(expr) && expr[0] === "get") return expr[1];
  else if (typeof expr === "string") return expr;
  else throw new Error("expected prop here??");
}
