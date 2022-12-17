import { f as useData, j as jsxs, a as jsx } from './index.3fbfe50f.js';

var index_bccy99 = '';

function UserProfile() {
  const {
    username,
    description
  } = useData();
  return /*#__PURE__*/jsxs("div", {
    className: "d19znui1",
    children: [/*#__PURE__*/jsx("h1", {
      children: username
    }), /*#__PURE__*/jsx("p", {
      children: description
    })]
  });
}

export { UserProfile as default };
