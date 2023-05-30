import { j as jsxs, a as jsx, L as Link, V as View } from './index.9463bbcd.js';

var index_ghsrbq = '';

function Layout() {
  return /*#__PURE__*/jsxs("section", {
    className: "slqc2n9",
    children: [/*#__PURE__*/jsxs("nav", {
      className: "n1yfeqyl",
      children: [/*#__PURE__*/jsxs("ul", {
        children: [/*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx(Link, {
            to: "/",
            children: "Home"
          })
        }), /*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx(Link, {
            to: "/users",
            children: "Users"
          })
        }), /*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx(Link, {
            to: "/help",
            children: "Help"
          })
        }), /*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx(Link, {
            to: "/about",
            children: "About"
          })
        })]
      }), "modes", /*#__PURE__*/jsxs("ul", {
        children: [/*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx("a", {
            href: "/native-router-react/demos/",
            children: "history"
          })
        }), /*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx("a", {
            href: `${"/native-router-react/demos/"}?hash`,
            children: "hash"
          })
        }), /*#__PURE__*/jsx("li", {
          children: /*#__PURE__*/jsx("a", {
            href: `${"/native-router-react/demos/"}?memory`,
            children: "memory"
          })
        })]
      }), /*#__PURE__*/jsx("a", {
        href: "//wmzy.github.io/native-router-react/",
        children: "docs"
      })]
    }), /*#__PURE__*/jsx("main", {
      className: "m1o95z1i",
      children: /*#__PURE__*/jsx(View, {})
    })]
  });
}
const globals = "g1j9sk9j";

export { Layout as default, globals };
