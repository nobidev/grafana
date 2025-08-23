package auditing

import (
	"fmt"
)

type NoopLogger struct{ debug bool }

func (l *NoopLogger) Log(event Event) error {
	if l.debug {
		fmt.Printf("NoopLogger: event logged: %#+v\n", event)
	}

	return nil
}
