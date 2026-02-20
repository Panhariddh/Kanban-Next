'use client';

import { gql } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Board = {
    id: number;
    title: string;
};

type GetBoardsResponse = {
    boards: Board[];
};

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

export default function HomePage() {
    const { data, refetch} = useQuery<GetBoardsResponse>(GET_BOARDS);
    const [createBoard] = useMutation(CREATE_BOARD);
    const [title, setTitle] = useState('');
    const router = useRouter();

    const handleCreate = async () => {
        if (!title.trim()) return;

        await createBoard({
            variables: { title },
        });

        setTitle('');
        refetch();

    };

    if (!data) return <p>Loading...</p>;

    return (
        <div style={{ padding: 20 }}>
            <h1>Your Boards</h1>

            {/* EXISTING BOARDS */}
            <div style={{ marginBottom: 20 }}>
                {data?.boards?.map((board: any) => (
                    <div
                        key={board.id}
                        style={{
                            padding: 12,
                            marginBottom: 10,
                            background: '#f1f5f9',
                            borderRadius: 8,
                            cursor: 'pointer',
                        }}
                        onClick={() => router.push(`/board/${board.id}`)}
                    >
                        {board.title}
                    </div>
                ))}
            </div>

            {/* CREATE BOARD */}
            <div>
                <input
                    placeholder="New board name..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                        padding: 8,
                        border: '1px solid #ccc',
                        borderRadius: 6,
                        marginRight: 10,
                    }}
                />

                <button onClick={handleCreate}>
                    Create Board
                </button>
            </div>
        </div>
    );
}