package kinds

correlationv0alpha1: {
	kind:       "Correlation"  // note: must be uppercase
	schema: {
		spec: {
			source_uid:  string
			target_uid:  string
			label:       string
			description: string
			config:      string
			provisioned: int
			type:        string
		}
	}
}