import { setLoaderEntries } from '$lib/components/History/historyState.svelte';
import type { State } from '$lib/types';
import { defaultState } from '$lib/util/state.svelte';
import { fetchJSON, fetchText } from '$lib/util/util';

const codeFileName = 'code.mmd';
const configFileName = 'config.json';
const MAX_GIST_REVISIONS = 20;

interface GithubFile {
  truncated: boolean;
  raw_url: string;
  content: string;
}

const isValidGist = (files: Record<string, GithubFile>): boolean => codeFileName in files;

const getGistIdentifiers = (gistURL: string): { gistID: string; revisionID?: string } => {
  const path = gistURL.split('github.com').pop();
  if (!path) throw new Error(`无效的 GitHub Gist 地址：${gistURL}`);
  const parts = path.split('/').filter(Boolean);
  const gistID = parts.at(-2) === 'gists' ? parts.at(-1) : parts.at(1);
  const revisionID = parts.at(-2) === 'gists' ? undefined : parts.at(2);
  if (!gistID) throw new Error(`无效的 GitHub Gist 地址：${gistURL}`);
  return { gistID, revisionID };
};

const getFileContent = async (file: GithubFile): Promise<string> => {
  if (file.truncated) {
    return await fetchText(file.raw_url);
  }
  return file.content;
};

interface GistData {
  code: string;
  config?: string;
  author: string;
  time: number;
  version: string;
  url: string;
}

interface GistResponse {
  files: Record<string, GithubFile>;
  html_url: string;
  history: { url: string; committed_at: string; version: string; user?: { login: string } }[];
}

const getGistData = async (gistURL: string): Promise<GistData> => {
  const { gistID, revisionID } = getGistIdentifiers(gistURL);

  const { html_url, files, history }: GistResponse = await fetchJSON(
    `https://api.github.com/gists/${gistID}${revisionID ? '/' + revisionID : ''}`
  );
  if (isValidGist(files)) {
    const code = await getFileContent(files[codeFileName]);
    let config = '{}';
    if (configFileName in files) {
      config = await getFileContent(files[configFileName]);
    }
    const currentItem = history[0];
    if (!currentItem) throw new Error('Gist 没有可读取的历史版本');
    return {
      author: currentItem.user?.login ?? '未知用户',
      code,
      config,
      time: new Date(currentItem.committed_at).getTime(),

      url: `${html_url}/${currentItem.version}`,
      version: currentItem.version.slice(-7)
    };
  } else {
    throw new Error('Gist 中缺少 code.mmd');
  }
};

const getStateFromGist = (gist: GistData, gistURL: string = gist.url): State => {
  const state: State = {
    ...defaultState,
    code: gist.code,
    loader: {
      config: {
        url: gistURL
      },
      type: 'gist'
    }
  };
  if (gist.config) {
    state.mermaid = gist.config;
  }
  return state;
};

export const loadGistData = async (gistURL: string): Promise<State> => {
  const { gistID, revisionID } = getGistIdentifiers(gistURL);

  const { history }: GistResponse = await fetchJSON(
    `https://api.github.com/gists/${gistID}${revisionID ? '/' + revisionID : ''}`
  );
  const gistHistory: GistData[] = [];
  for (const entry of history.slice(0, MAX_GIST_REVISIONS)) {
    try {
      const data: GistData = await getGistData(entry.url);
      gistHistory.push(data);
    } catch (error) {
      console.error(error);
    }
  }
  if (gistHistory.length === 0) {
    throw new Error('Gist 中没有可读取的图表版本');
  }
  gistHistory.reverse();
  const entry = gistHistory.at(-1);
  if (!entry) {
    throw new Error('Gist 中没有可读取的图表版本');
  }
  const state = getStateFromGist(entry, gistURL);
  setLoaderEntries(
    gistHistory
      .map((gist) => ({
        name: `${gist.author} v${gist.version}`,
        state: getStateFromGist(gist),
        time: gist.time,
        type: 'loader' as const,
        url: gist.url
      }))
      .reverse()
  );
  return state;
};
