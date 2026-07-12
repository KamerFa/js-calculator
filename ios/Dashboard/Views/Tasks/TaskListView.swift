import SwiftUI

struct TaskListView: View {
    @Environment(AuthStore.self) private var auth
    @State private var store: TaskStore?
    @State private var editingTask: TaskItem?
    @State private var isPresentingNewTask = false
    @State private var pendingDelete: TaskItem?

    var body: some View {
        NavigationStack {
            Group {
                if let store {
                    content(store: store)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isPresentingNewTask = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .task {
            if store == nil {
                store = TaskStore(auth: auth)
            }
            await store?.loadAll()
        }
        .sheet(isPresented: $isPresentingNewTask) {
            if let store {
                TaskFormView(store: store, task: nil)
            }
        }
        .sheet(item: $editingTask) { task in
            if let store {
                TaskFormView(store: store, task: task)
            }
        }
        .confirmationDialog(
            "Delete task?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { task in
            Button("Delete \"\(task.title)\"", role: .destructive) {
                Task { await store?.delete(task) }
            }
        }
    }

    @ViewBuilder
    private func content(store: TaskStore) -> some View {
        if store.isLoading && store.tasks.isEmpty {
            ProgressView()
        } else if store.tasks.isEmpty {
            ContentUnavailableView(
                "No tasks yet",
                systemImage: "checklist",
                description: Text("Tap + to create your first task.")
            )
        } else {
            List {
                ForEach(store.tasks) { task in
                    TaskRowView(
                        task: task,
                        project: store.project(for: task),
                        currentUserId: currentUserId,
                        onToggle: { Task { await store.toggle(task) } },
                        onEdit: { editingTask = task },
                        onDelete: { pendingDelete = task }
                    )
                }
            }
            .listStyle(.plain)
            .refreshable { await store.loadAll() }
            .alert("Error", isPresented: errorBinding(store: store)) {
                Button("OK") { store.errorMessage = nil }
            } message: {
                Text(store.errorMessage ?? "")
            }
        }
    }

    private var currentUserId: String {
        if case .loggedIn(let user) = auth.state { return user.id }
        return ""
    }

    private func errorBinding(store: TaskStore) -> Binding<Bool> {
        Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })
    }
}
