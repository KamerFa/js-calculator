import SwiftUI

/// Placeholder shell for the Phase 1 tab structure. Each tab gets replaced by
/// its real feature screen as Phase 1 lands (Tasks, Projects, Calendar, Notes).
struct HomeView: View {
    @Environment(AuthStore.self) private var auth
    let user: User

    var body: some View {
        TabView {
            placeholder("Tasks", systemImage: "checklist")
            placeholder("Projects", systemImage: "square.grid.2x2")
            placeholder("Calendar", systemImage: "calendar")
            placeholder("Notes", systemImage: "note.text")

            NavigationStack {
                List {
                    Section {
                        LabeledContent("Username", value: user.username)
                    }
                    Section {
                        Button("Log Out", role: .destructive) {
                            auth.logout()
                        }
                    }
                }
                .navigationTitle("Profile")
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }

    private func placeholder(_ title: String, systemImage: String) -> some View {
        NavigationStack {
            ContentUnavailableView(
                "\(title) coming soon",
                systemImage: systemImage,
                description: Text("This screen is part of Phase 1 of the iOS build.")
            )
            .navigationTitle(title)
        }
        .tabItem { Label(title, systemImage: systemImage) }
    }
}
