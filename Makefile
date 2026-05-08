IMAGE_NAME ?= portfolio-comparator
IMAGE_TAG  ?= latest
VERSION    ?= # e.g. v1.2.0 — if set, image is also tagged with this version
REGISTRY   ?= # e.g. ghcr.io/username, docker.io/username, 123456789.dkr.ecr.us-east-1.amazonaws.com
PLATFORMS  ?= linux/amd64,linux/arm64
BUILDER    ?= portfolio-comparator-builder

FULL_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(IMAGE_TAG)
VERSION_IMAGE = $(if $(REGISTRY),$(REGISTRY)/$(IMAGE_NAME),$(IMAGE_NAME)):$(VERSION)

TAG_FLAGS = -t $(FULL_IMAGE) $(if $(VERSION),-t $(VERSION_IMAGE),)

.PHONY: buildx-setup build build-local push release

buildx-setup:
	@docker buildx inspect $(BUILDER) >/dev/null 2>&1 || docker buildx create --name $(BUILDER) --driver docker-container

build: buildx-setup
	docker buildx build --builder $(BUILDER) --platform $(PLATFORMS) $(TAG_FLAGS) .

build-local:
	docker buildx build --load $(TAG_FLAGS) .

push: buildx-setup
	docker buildx build --builder $(BUILDER) --platform $(PLATFORMS) $(TAG_FLAGS) --push .

release: push
