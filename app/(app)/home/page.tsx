'use client';

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// --- Types ---
type Board = {
    id: number;
    title: string;
};

type GetBoardsResponse = {
    boards: Board[];
};

// --- GraphQL ---
const GET_BOARDS = gql`
  query {
    boards {
      id
      title
    }
  }
`;

const CREATE_BOARD = gql`
  mutation ($title: String!) {
    createBoard(title: $title) {
      id
      title
    }
  }
`;

const DELETE_BOARD = gql`
  mutation ($id: Float!) {
    deleteBoard(id: $id)
  }
`;

export default function HomePage() {
    const { data, loading, refetch } = useQuery<GetBoardsResponse>(GET_BOARDS);
    const [createBoard, { loading: isCreating }] = useMutation(CREATE_BOARD);
    const [deleteBoard] = useMutation<
        { deleteBoard: boolean },
        { id: number }
    >(DELETE_BOARD);
    const [title, setTitle] = useState('');
    const router = useRouter();

    const handleCreate = async () => {
        if (!title.trim()) return;

        try {
            await createBoard({
                variables: { title },
            });
            setTitle('');
            refetch();
        } catch (error) {
            console.error("Failed to create board", error);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteBoard({
                variables: { id: Number(id) },

                optimisticResponse: {
                    deleteBoard: true,
                },

                update: (cache) => {
                    cache.updateQuery(
                        { query: GET_BOARDS },
                        (existing: GetBoardsResponse | null) => {
                            if (!existing) return existing;

                            return {
                                boards: existing.boards.filter(
                                    (b) => Number(b.id) !== Number(id)
                                ),
                            };
                        }
                    );
                },
            });
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate();
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-800">
            <div className="mx-auto max-w-5xl">

                {/* Header Section */}
                <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manage your project boards</p>
                    </div>

                    {/* Create Board Input */}
                    <div className="flex w-full max-w-md gap-2">
                        <input
                            type="text"
                            placeholder="Create new board..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isCreating}
                            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!title.trim() || isCreating}
                            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
                        >
                            {isCreating ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                </header>

                {/* Boards Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {data?.boards && data.boards.length > 0 ? (
                        data.boards.map((board) => (
                            <div
                                key={board.id}

                                className="group relative flex flex-col justify-between rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
                            >
                                {/* DELETE BUTTON */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation(); // IMPORTANT (prevent navigation)
                                        handleDelete(board.id);
                                    }}
                                    className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                                >
                                    ✕
                                </button>
                                <div onClick={() => router.push(`/board/${board.id}`)}>
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                        {board.title}
                                    </h3>
                                    <div className="mt-2 flex items-center text-sm text-slate-400">
                                        <span>ID: #{board.id}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
                            <p className="text-lg font-medium text-slate-500">No boards found</p>
                            <p className="text-sm text-slate-400">Create your first board to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}