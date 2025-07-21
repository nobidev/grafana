package flightsql

import (
	"sync"

	"github.com/apache/arrow-go/v18/arrow/flight"
	"github.com/apache/arrow-go/v18/arrow/ipc"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"google.golang.org/grpc/metadata"
)

// FlightReader wraps flight.Reader to expose gRPC headers on first Recv.
type FlightReader struct {
	reader    *flight.Reader
	extractor *headerExtractor
	allocator *memory.Allocator
}

type FlightReaderOption func(*FlightReader)

// NewFlightReader constructs a FlightReader.
func NewFlightReader(stream flight.FlightService_DoGetClient, opts ...FlightReaderOption) (*FlightReader, error) {
	r := &FlightReader{
		extractor: &headerExtractor{stream: stream},
		// Use the default allocator if none is provided.
		allocator: &memory.DefaultAllocator,
	}

	for _, opt := range opts {
		opt(r)
	}

	reader, err := flight.NewRecordReader(r.extractor, ipc.WithAllocator(*r.allocator))
	if err != nil {
		return nil, err
	}
	r.reader = reader

	return r, nil
}

// WithAllocator sets the memory allocator for the FlightReader.
func WithAllocator(alloc memory.Allocator) func(*FlightReader) {
	return func(r *FlightReader) {
		r.allocator = &alloc
	}
}

// Header returns the metadata captured at the start of the stream.
func (r *FlightReader) Header() (metadata.MD, error) {
	return r.extractor.Header()
}

// Release frees reader resources.
func (r *FlightReader) Release() {
	r.reader.Release()
}

// Raw returns the underlying flight.Reader.
func (r *FlightReader) Raw() *flight.Reader {
	return r.reader
}

// headerExtractor captures headers on first Recv().
type headerExtractor struct {
	stream flight.FlightService_DoGetClient

	once   sync.Once
	header metadata.MD
	err    error
}

// Header gives you the captured metadata or error from the first Recv.
func (h *headerExtractor) Header() (metadata.MD, error) {
	return h.header, h.err
}

// Recv pulls from the gRPC stream and on the first call captures headers.
func (h *headerExtractor) Recv() (*flight.FlightData, error) {
	data, err := h.stream.Recv()
	h.once.Do(func() {
		h.header, h.err = h.stream.Header()
	})
	return data, err
}
