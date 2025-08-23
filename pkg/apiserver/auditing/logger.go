package auditing

import "context"

type loggerContextKey struct{}

var (
	DefaultLogger Logger = &NoopLogger{true}

	contextKey = loggerContextKey{}
)

type Logger interface {
	Log(event Event) error
}

func FromContext(ctx context.Context) Logger {
	if l := ctx.Value(contextKey); l != nil {
		if logger, ok := l.(Logger); ok {
			return logger
		}
	}

	if DefaultLogger != nil {
		return DefaultLogger
	}

	return &NoopLogger{true}
}

func Context(ctx context.Context, logger Logger) context.Context {
	return context.WithValue(ctx, contextKey, logger)
}
