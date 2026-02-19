'use client';

import { ApolloCache, gql, DefaultContext } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';


type Task = {
    id: number;
    title: string;
    status: string;
};

type Board = {
    id: number;
    title: string;
    tasks: Task[];
};

type CreateTaskResponse = {
    createTask: {
        id: number;
        title: string;
    };
};


type GetBoardsResponse = {
    boards: Board[];
};

type TaskUpdatedResponse = {
    taskUpdated: Task;
};

const GET_BOARDS = gql`
  query {
    boards {
      id
      title
      tasks {
        id
        title
        status
      }
    }
  }
`;

const TASK_UPDATED = gql`
  subscription ($boardId: Float!) {
    taskUpdated(boardId: $boardId) {
      id
      title
      status
    }
  }
`;

const CREATE_TASK = gql`
  mutation ($title: String!, $boardId: Float!) {
    createTask(title: $title, boardId: $boardId) {
      id
      title
    }
  }
`;

const MOVE_TASK = gql`
  mutation ($taskId: Float!, $status: TaskStatus!) {
    moveTask(taskId: $taskId, status: $status)
  }
`;

const DELETE_TASK = gql`
  mutation ($id: Float!) {
    deleteTask(id: $id)
  }
`;


export default function BoardPage() {
    const { data, refetch } = useQuery<GetBoardsResponse>(GET_BOARDS);
    const [title, setTitle] = useState('');
    const [createTask] = useMutation<CreateTaskResponse>(CREATE_TASK);
    const [moveTask] = useMutation(MOVE_TASK);
    const [deleteTask] = useMutation<
        { deleteTask: boolean },
        { id: number }
    >(DELETE_TASK);

    const columns = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

    useSubscription<TaskUpdatedResponse>(TASK_UPDATED, {
        variables: {
            boardId: data?.boards?.[0]?.id
                ? Number(data.boards[0].id)
                : 0,
        },
        skip: !data || data.boards.length === 0,

        onData: ({ client, data: subData }) => {
            const updatedTask = subData.data?.taskUpdated;
            if (!updatedTask) return;

            client.cache.updateQuery(
                { query: GET_BOARDS },
                (existing: GetBoardsResponse | null) => {
                    if (!existing) return existing;

                    return {
                        boards: existing.boards.map((board) => {
                            const exists = board.tasks.some(
                                (t) => Number(t.id) === Number(updatedTask.id)
                            );

                            return {
                                ...board,
                                tasks: exists
                                    ? board.tasks.map((task) =>
                                        Number(task.id) === Number(updatedTask.id)
                                            ? updatedTask
                                            : task
                                    )
                                    : board.tasks.filter(
                                        (task) => Number(task.id) !== Number(updatedTask.id)
                                    ),
                            };
                        }),
                    };
                }
            );
        },
    });

    if (!data || data.boards.length === 0) {
        return <p>No boards</p>;
    }

    const board = data.boards[0];

    const todo = board.tasks.filter((t) => t.status === 'TODO');
    const inProgress = board.tasks.filter((t) => t.status === 'IN_PROGRESS');
    const done = board.tasks.filter((t) => t.status === 'DONE');

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) return;

        const taskId = active.id;
        const newStatus = over.id as 'TODO' | 'IN_PROGRESS' | 'DONE';
        console.log('MOVE:', taskId, newStatus);

        moveTask({
            variables: {
                taskId: Number(taskId),
                status: newStatus,
            },

            optimisticResponse: {
                moveTask: true,
            },

            update: (cache) => {
                cache.updateQuery(
                    { query: GET_BOARDS },
                    (existing: GetBoardsResponse | null) => {
                        if (!existing) return existing;

                        return {
                            boards: existing.boards.map((board) => ({
                                ...board,
                                tasks: board.tasks.map((task) => {
                                    if (Number(task.id) === Number(taskId)) {
                                        return {
                                            ...task,
                                            status: newStatus,
                                        };
                                    }
                                    return task;
                                }),
                            })),
                        };
                    }
                );
            },

        });
    };

    const handleCreateTask = () => {
        if (!title.trim()) return;

        createTask({
            variables: {
                title,
                boardId: Number(board.id),
            },

            update: (cache, { data }) => {
                const newTask = data?.createTask;
                if (!newTask) return;

                cache.updateQuery(
                    { query: GET_BOARDS },
                    (existing: GetBoardsResponse | null) => {
                        if (!existing) return existing;

                        return {
                            boards: existing.boards.map((b) =>
                                b.id === board.id
                                    ? {
                                        ...b,
                                        tasks: [
                                            ...b.tasks,
                                            { ...newTask, status: 'TODO' },
                                        ],
                                    }
                                    : b
                            ),
                        };
                    }
                );
            },
        });

        setTitle('');
    };


    return (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div style={{ padding: 20 }}>
                <h1>{board.title}</h1>

                <div style={{ display: 'flex', gap: 20 }}>
                    {columns.map((col) => (
                        <Column
                            key={col + board.tasks.length}
                            id={col}
                            title={col}
                            tasks={board.tasks.filter((t) => t.status === col)}
                            deleteTask={deleteTask}
                        />
                    ))}
                </div>

                <div style={{ marginTop: 20 }}>
                    <input
                        type="text"
                        placeholder="Enter task title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}

                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateTask(); // use same logic
                            }
                        }}

                        style={{
                            padding: 8,
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            marginRight: 10,
                        }}
                    />

                    <button onClick={handleCreateTask}>
                        Add Task
                    </button>
                </div>
            </div>
        </DndContext>
    );
}

function Column({
    id,
    title,
    tasks,
    deleteTask,
}: {
    id: string;
    title: string;
    tasks: any[];
    deleteTask: any;
}) {
    const { setNodeRef } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                width: 250,
                minHeight: 300,
                background: '#f4f4f4',
                padding: 10,
                borderRadius: 8,
            }}
        >
            <h3>{title}</h3>

            {tasks.map((task) => (
                <TaskCard key={task.id} task={task} deleteTask={deleteTask} />
            ))}
        </div>
    );
}

function TaskCard({ task, deleteTask }: { task: any; deleteTask: any }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: task.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        background: 'white',
        padding: 10,
        marginBottom: 10,
        borderRadius: 6,
        cursor: 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{task.title}</span>

                {/* DELETE BUTTON */}
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation(); // prevent drag conflict

                        deleteTask({
                            variables: {
                                id: Number(task.id),
                            },

                            optimisticResponse: {
                                deleteTask: true,
                            },

                            update: (cache: ApolloCache,
                                { data }: { data?: { deleteTask: boolean } }) => {
                                if (!data?.deleteTask) return;

                                cache.updateQuery(
                                    { query: GET_BOARDS },
                                    (existing: GetBoardsResponse | null) => {
                                        if (!existing) return existing;

                                        return {
                                            boards: existing.boards.map((board) => ({
                                                ...board,
                                                tasks: board.tasks.filter(
                                                    (t) => Number(t.id) !== Number(task.id)
                                                ),
                                            })),
                                        };
                                    }
                                );
                            },
                        });
                    }}
                    style={{
                        background: 'red',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        padding: '2px 6px',
                    }}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
