/**
 * Type-level tests for `RoutePaths` / `createRoutes` / `TypedLink`
 * (任务 1：类型安全的 Link to)。
 *
 * 本文件由 vitest `typecheck.include` 以 `tsc --noEmit` 收集（源码见
 * vitest.config.ts），断言全在类型层：`@ts-expect-error` 处期望编译
 * 错误出现，多余或缺失的 props 期望被 union 判别拒绝。运行时行为在
 * test/integration.test.tsx 的 `TypedLink` describe 中覆盖。
 *
 * 归并建议：后续路由表类型工具的用例继续追加到本文件。
 */
import {describe, expectTypeOf, it} from 'vitest';
import {MemoryRouter, TypedLink, View, createRoutes} from '../src/index';
import type {Route, RoutePaths} from '../src/types';

function Page() {
  return <div>Page</div>;
}

describe('RoutePaths', () => {
  it('should collect literal patterns from a nested table created with createRoutes', () => {
    const routes = createRoutes({
      component: () => Page,
      children: [
        {path: '/', component: () => Page},
        {
          path: '/users',
          component: () => Page,
          children: [{path: '/:id', component: () => Page}]
        },
        {path: '/article/:title', component: () => Page}
      ]
    });
    // The table is a type-level fixture; reference it at runtime so the
    // binding is not "only used as a type".
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<
      '/' | '/users/:id' | '/article/:title'
    >();
  });

  it('should pass children patterns through a layout level without path', () => {
    const routes = createRoutes({
      component: () => Page,
      children: [{path: '/help', component: () => Page}]
    });
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<'/help'>();
  });

  it('should collect from an array table and keep wildcard params', () => {
    const routes = createRoutes([
      {path: '/', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]);
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<
      '/' | '/files/*rest'
    >();
  });

  it('should degrade to string when the table is asserted with `as Route`', () => {
    const routes = {
      children: [{path: '/users', component: () => Page}]
    } as Route;
    void routes;
    expectTypeOf<RoutePaths<typeof routes>>().toEqualTypeOf<string>();
  });
});

describe('TypedLink', () => {
  const routes = createRoutes({
    children: [
      {path: '/', component: () => Page},
      {path: '/users/:id', component: () => Page},
      {path: '/files/*rest', component: () => Page}
    ]
  });
  type Paths = RoutePaths<typeof routes>;

  it('should accept a table pattern and require its params', () => {
    expectTypeOf<Paths>().toEqualTypeOf<'/' | '/users/:id' | '/files/*rest'>();

    const app = (
      <MemoryRouter routes={routes}>
        <TypedLink<Paths> to="/" />
        <TypedLink<Paths> to="/users/:id" params={{id: '7'}} />
        <TypedLink<Paths> to="/files/*rest" params={{rest: ['a', 'b']}} />
        <View />
      </MemoryRouter>
    );
    expectTypeOf(app).not.toBeNever();
  });

  it('should reject a path outside the table', () => {
    <TypedLink<Paths>
      // @ts-expect-error '/help' is not a pattern of the table
      to="/help"
    />;
  });

  it('should reject a static pattern passed params', () => {
    <TypedLink<Paths>
      to="/"
      // @ts-expect-error static patterns take no params
      params={{id: '7'}}
    />;
  });

  it('should reject a missing or wrongly typed required param', () => {
    // @ts-expect-error params are required for '/users/:id'
    <TypedLink<Paths> to="/users/:id" />;
    <TypedLink<Paths>
      to="/users/:id"
      // @ts-expect-error id must be a string, not a number
      params={{id: 7}}
    />;
    <TypedLink<Paths>
      to="/files/*rest"
      // @ts-expect-error wildcard params are string arrays
      params={{rest: 'a'}}
    />;
  });
});
