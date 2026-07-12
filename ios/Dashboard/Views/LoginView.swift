import SwiftUI

struct LoginView: View {
    private enum Mode: String, CaseIterable {
        case login = "Log In"
        case register = "Sign Up"
    }

    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .login
    @State private var username = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    @FocusState private var focusedField: Field?
    private enum Field { case username, password }

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 4
            && !isSubmitting
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("Dashboard")
                    .font(.largeTitle.bold())
                Text("Your productivity hub")
                    .foregroundStyle(.secondary)
            }

            Picker("Mode", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
            }
            .pickerStyle(.segmented)

            VStack(spacing: 12) {
                TextField("Username", text: $username)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .username)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }

                SecureField("Password", text: $password)
                    .textContentType(mode == .register ? .newPassword : .password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { if canSubmit { submit() } }
            }
            .textFieldStyle(.roundedBorder)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button(action: submit) {
                Group {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Text(mode.rawValue)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmit)

            if mode == .register && !password.isEmpty && password.count < 4 {
                Text("Password must be at least 4 characters")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Spacer()
            Spacer()
        }
        .padding(.horizontal, 32)
        .onChange(of: mode) { errorMessage = nil }
    }

    private func submit() {
        errorMessage = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                switch mode {
                case .login:
                    try await auth.login(username: username, password: password)
                case .register:
                    try await auth.register(username: username, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
