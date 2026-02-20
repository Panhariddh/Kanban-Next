'use client';

import { ApolloCache, gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    useDroppable,
    DragOverlay,
    useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// ============== TYPES (UNCHANGED) ==============
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

// ============== GRAPHQL OPERATIONS (UNCHANGED) ==============
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

// ============== MAIN COMPONENT ==============
export default function BoardPage() {
    const { data, refetch } = useQuery<GetBoardsResponse>(GET_BOARDS);
    const [title, setTitle] = useState('');
    const [createTask] = useMutation<CreateTaskResponse>(CREATE_TASK);
    const [moveTask] = useMutation(MOVE_TASK);
    const [deleteTask] = useMutation<{ deleteTask: boolean }, { id: number }>(DELETE_TASK);
    const [activeId, setActiveId] = useState<number | null>(null);
    const params = useParams();
    const boardId = params.id;

    const columns = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

    // Subscription logic
    useSubscription<TaskUpdatedResponse>(TASK_UPDATED, {
        variables: {
            boardId: boardId ? Number(boardId) : 0,
        },
        skip: !data || data.boards.length === 0 || !boardId,
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
        return (
            <div style={styles.emptyState}>
                <h2>📋 No boards available</h2>
                <p>Create a board to get started</p>
            </div>
        );
    }

    if (!data || !boardId) {
    return <p>Loading...</p>;
    }

    const board = data.boards.find((b) => Number(b.id) === Number(boardId));

    if (!board) {
        return <p>Board not found</p>;
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id;
        const newStatus = over.id as 'TODO' | 'IN_PROGRESS' | 'DONE';

        moveTask({
            variables: {
                taskId: Number(taskId),
                status: newStatus,
            },
            optimisticResponse: { moveTask: true },
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
                                        return { ...task, status: newStatus };
                                    }
                                    return task;
                                }),
                            })),
                        };
                    }
                );
            },
        });
        setActiveId(null);
    };

    const handleCreateTask = () => {
        if (!title.trim()) return;
        createTask({
            variables: { title, boardId: Number(board.id) },
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
                                        tasks: [...b.tasks, { ...newTask, status: 'TODO' }],
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
        <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragStart={({ active }) => setActiveId(Number(active.id))}
        >
            <div style={styles.pageContainer}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerContent}>
                        <h1 style={styles.boardTitle}>{board.title}</h1>
                        <span style={styles.taskCount}>
                            {board.tasks.length} task{board.tasks.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </header>

                <style>{`
                        @media (max-width: 1024px) {
                        .board-grid {
                            grid-template-columns: 1fr !important;
                        }
                        }
                        
                        /* Darker placeholder across browsers */
                        .task-input::placeholder {
                        color: #475569 !important;
                        opacity: 1 !important;
                        }
                        .task-input::-webkit-input-placeholder { color: #475569; }
                        .task-input::-moz-placeholder { color: #475569; }
                        .task-input:-ms-input-placeholder { color: #475569; }
                        
                        /* Ensure input text is dark */
                        .task-input {
                        color: #1e293b !important;
                        }
                `}</style>


                {/* Board Columns */}
                <div style={styles.board} className="board-grid">
                    {columns.map((col) => (
                        <Column
                            key={col}
                            id={col}
                            title={getColumnTitle(col)}
                            tasks={board.tasks.filter((t) => t.status === col)}
                            deleteTask={deleteTask}
                        />
                    ))}
                </div>

                {/* Add Task Section */}
                <div style={styles.addTaskContainer}>
                    <div style={styles.addTaskWrapper}>
                        <input
                            type="text"
                            className="task-input"
                            placeholder="✨ Add a new task..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreateTask();
                                }
                            }}
                            style={styles.taskInput}
                        />
                        <button onClick={handleCreateTask} style={styles.addButton}>
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for smooth dragging */}
            <DragOverlay>
                {activeId ? (
                    <div style={styles.dragOverlay}>
                        {board.tasks.find(t => Number(t.id) === activeId)?.title}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// ============== COLUMN COMPONENT ==============
function Column({
    id,
    title,
    tasks,
    deleteTask,
}: {
    id: string;
    title: string;
    tasks: Task[];
    deleteTask: any;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const columnColors: Record<string, { bg: string; accent: string }> = {
        TODO: { bg: '#fef3c7', accent: '#f59e0b' },
        IN_PROGRESS: { bg: '#dbeafe', accent: '#3b82f6' },
        DONE: { bg: '#dcfce7', accent: '#22c55e' },
    };

    const colors = columnColors[id] || { bg: '#f1f5f9', accent: '#64748b' };

    return (
        <div
            ref={setNodeRef}
            style={{
                ...styles.column,
                backgroundColor: isOver ? `${colors.bg}cc` : colors.bg,
                border: `2px dashed ${isOver ? colors.accent : 'transparent'}`,
            }}
        >
            {/* Column Header */}
            <div style={{ ...styles.columnHeader, borderTopColor: colors.accent }}>
                <h3 style={styles.columnTitle}>{title}</h3>
                <span style={styles.taskBadge}>{tasks.length}</span>
            </div>

            {/* Tasks List */}
            <div style={styles.taskList}>
                {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} deleteTask={deleteTask} />
                ))}
                {tasks.length === 0 && (
                    <div style={styles.emptyColumn}>
                        <span style={styles.emptyText}>No tasks</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============== TASK CARD COMPONENT ==============
function TaskCard({ task, deleteTask }: { task: Task; deleteTask: any }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        ...styles.taskCard,
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={styles.taskContent}>
                <span style={styles.taskTitle}>{task.title}</span>

                {/* Delete Button */}
                <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        deleteTask({
                            variables: { id: Number(task.id) },
                            optimisticResponse: { deleteTask: true },
                            update: (cache: ApolloCache, { data }: { data?: { deleteTask: boolean } }) => {
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
                    style={styles.deleteButton}
                    aria-label="Delete task"
                >
                    ✕
                </button>
            </div>

            {/* Subtle drag hint */}
            <div style={styles.dragHandle}>⋮⋮</div>
        </div>
    );
}

// ============== HELPER FUNCTIONS ==============
function getColumnTitle(status: string): string {
    const titles: Record<string, string> = {
        TODO: '📝 To Do',
        IN_PROGRESS: '🔄 In Progress',
        DONE: '✅ Done',
    };
    return titles[status] || status;
}

// ============== STYLES ==============
const styles: Record<string, React.CSSProperties> = {
    // Page Layout
    pageContainer: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },

    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'white',
        textAlign: 'center',
        padding: '20px',
    },

    // Header
    header: {
        marginBottom: '24px',
    },
    headerContent: {
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
    },
    boardTitle: {
        color: 'white',
        fontSize: '28px',
        fontWeight: '700',
        margin: 0,
        textShadow: '0 2px 4px rgba(0,0,0,0.1)',
    },
    taskCount: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: '14px',
        background: 'rgba(255,255,255,0.2)',
        padding: '4px 12px',
        borderRadius: '20px',
    },

    // Board Grid
    board: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        maxWidth: '1400px',
        margin: '0 auto',
        paddingBottom: '20px',
    },

    // Column
    column: {
        borderRadius: '12px',
        padding: '16px',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
    },
    columnHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 4px',
        marginBottom: '12px',
        borderTop: '4px solid',
    },
    columnTitle: {
        margin: 0,
        fontSize: '16px',
        fontWeight: '600',
        color: '#1e293b',
    },
    taskBadge: {
        background: 'rgba(0,0,0,0.1)',
        color: '#475569',
        fontSize: '12px',
        fontWeight: '600',
        padding: '2px 10px',
        borderRadius: '12px',
        minWidth: '24px',
        textAlign: 'center',
    },
    taskList: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    emptyColumn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#94a3b8',
        fontSize: '14px',
    },
    emptyText: {
        fontStyle: 'italic',
    },

    // Task Card
    taskCard: {
        background: 'white',
        borderRadius: '10px',
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
    },
    taskContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        minWidth: 0,
    },
    taskTitle: {
        fontSize: '14px',
        color: '#1e293b',
        lineHeight: '1.4',
        wordBreak: 'break-word',
    },
    deleteButton: {
        background: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.15s ease',
    },
    dragHandle: {
        color: '#cbd5e1',
        fontSize: '12px',
        marginLeft: '8px',
        cursor: 'grab',
        userSelect: 'none',
        lineHeight: 1,
    },

    // Add Task Section
    addTaskContainer: {
        maxWidth: '1400px',
        margin: '0 auto',
        paddingTop: '16px',
    },
    addTaskWrapper: {
        display: 'flex',
        gap: '12px',
        background: 'white',
        padding: '8px',
        borderRadius: '12px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
    },
    taskInput: {
        flex: 1,
        border: 'none',
        padding: '12px 16px',
        fontSize: '14px',
        borderRadius: '8px',
        outline: 'none',
        background: '#f8fafc',
        transition: 'background 0.2s ease',
    },
    addButton: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'transform 0.1s ease, box-shadow 0.2s ease',
        boxShadow: '0 2px 4px rgba(102, 126, 234, 0.4)',
    },

    // Drag Overlay
    dragOverlay: {
        background: 'white',
        padding: '14px 16px',
        borderRadius: '10px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        fontSize: '14px',
        color: '#1e293b',
        maxWidth: '250px',
        wordBreak: 'break-word',
    },
};
