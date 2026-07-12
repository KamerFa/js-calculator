import SwiftUI

struct RootView: View {
    @Environment(AuthStore.self) private var auth

    var body: some View {
        switch auth.state {
        case .restoring:
            RestoringSessionView()
                .task { await auth.restoreSession() }
        case .loggedOut:
            LoginView()
        case .loggedIn(let user):
            HomeView(user: user)
        }
    }
}

/// Launch state that tolerates Render free-tier cold starts (20–50s):
/// after a few seconds of silence it explains the wait instead of looking hung.
private struct RestoringSessionView: View {
    @State private var showSlowServerHint = false

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            if showSlowServerHint {
                Text("Waking up the server — this can take up to a minute after it's been idle.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
                    .transition(.opacity)
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(5))
            withAnimation { showSlowServerHint = true }
        }
    }
}
