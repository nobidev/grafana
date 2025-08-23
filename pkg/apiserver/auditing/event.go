package auditing

import "time"

type Event struct {
	// The namespace the action was performed in.
	Namespace string `json:"namespace"`

	// When it happened.
	ObservedAt time.Time `json:"observedAt"`

	// Who/what performed the action.
	Subject string `json:"subject"`

	// What was performed.
	Verb string `json:"verb"`

	// The object the action was performed on. For verbs like "list" this will be empty.
	Object string `json:"object,omitempty"`

	// API information.
	APIGroup   string `json:"apiGroup,omitempty"`
	APIVersion string `json:"apiVersion,omitempty"`
	Kind       string `json:"kind,omitempty"`

	// Outcome of the action.
	Outcome EventOutcome `json:"outcome"`

	// Extra fields to add more context to the event.
	Extra map[string]string `json:"extra,omitempty"`
}

type EventOutcome string

const (
	EventOutcomeUnknown             EventOutcome = "unknown"
	EventOutcomeSuccess             EventOutcome = "success"
	EventOutcomeFailureUnauthorized EventOutcome = "failure_unauthorized"
	EventOutcomeFailureNotFound     EventOutcome = "failure_not_found"
	EventOutcomeFailureGeneric      EventOutcome = "failure_generic"
)
