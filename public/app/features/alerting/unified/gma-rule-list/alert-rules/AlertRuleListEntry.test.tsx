import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL } from '../mocks/handlers';

import { AlertRuleListEntry } from './AlertRuleListEntry';

const server = setupMswServer();

describe('AlertRuleListEntry', () => {
  it('shows the folder path from the folder parents lookup, root first', async () => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Alerts' },
          ],
        })
      )
    );

    render(
      <ul>
        <AlertRuleListEntry searchHit={{ uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1' }} showFolderPath />
      </ul>
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Platform').compareDocumentPosition(screen.getByText('Team Alerts'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('looks up no folder path when the folder row already shows it', async () => {
    let parentLookups = 0;
    server.use(
      http.get(FOLDER_PARENTS_URL, () => {
        parentLookups += 1;
        return HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] });
      })
    );

    render(
      <ul>
        <AlertRuleListEntry
          searchHit={{ uid: 'rule-1', title: 'CPU high', folderUid: 'folder-1' }}
          showFolderPath={false}
        />
      </ul>
    );

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
    expect(parentLookups).toBe(0);
  });
});
