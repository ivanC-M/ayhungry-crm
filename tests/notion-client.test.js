const { queryAllPages, fetchPage } = require('../lib/notion-client');

function makeFakeClient(pagesByCursor) {
  return {
    databases: {
      query: jest.fn(({ start_cursor }) => Promise.resolve(pagesByCursor[start_cursor || 'first'])),
    },
    pages: {
      retrieve: jest.fn(({ page_id }) => Promise.resolve({ id: page_id })),
    },
  };
}

test('queryAllPages follows pagination until has_more is false', async () => {
  const client = makeFakeClient({
    first: { results: [{ id: 'a' }, { id: 'b' }], has_more: true, next_cursor: 'cursor-2' },
    'cursor-2': { results: [{ id: 'c' }], has_more: false, next_cursor: null },
  });

  const pages = await queryAllPages(client, 'db-1');

  expect(pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  expect(client.databases.query).toHaveBeenCalledTimes(2);
});

test('fetchPage retrieves a single page by id', async () => {
  const client = makeFakeClient({});
  const page = await fetchPage(client, 'page-42');
  expect(page).toEqual({ id: 'page-42' });
});
